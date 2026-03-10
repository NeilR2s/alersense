#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "WiFi.h"
#include "HTTPClient.h"
#include "WiFiClientSecure.h"

/*
Network Config
*/
const char *ssid = "";
const char *password = "";
const char *serverName = "https://alersense-ghbxgzesfva7cfd0.southeastasia-01.azurewebsites.net/api/telemetry";
const String deviceID = "S-0001";

/*
ESP Hardware Configs
*/
const int PIN_GSR = 0;
const int SDA_PIN = 10;
const int SCL_PIN = 9;
MAX30105 particleSensor;

/*
Hardware Magic Number Configs
*/
const float MICROSIEMENS_CONVERSION_FACTOR = 1000000.0;
const float MICROSIEMENS_CALIBRATION_FACTOR = 1.0978;
const int WIFI_CONNECTION_DELAY = 1500;
const int CALIBRATION_DELAY = 30000;
const int STARTUP_DELAY = 300;
const int WIRE_CLOCK = 100000;
const float ADC_MAX_VAL = 6095.0; // this is a hacky solution, but it works for now
const float FIXED_RESISTOR_OHMS = 5000.0;
const float TEMP_BASELINE_REF = 37.0;
const float TEMP_COEFF = 0.03;

const float THRESHOLD_GSR_PERCENT = -9.49;
const float THRESH_HR_PERCENT = -3.98;
const float TEMP_ANALOG_SCALING = 0.488;
const long THRESHOLD_IR_DETECTION = 50000;

const float GSR_ROLLING_ALPHA = 0.005;
const float GSR_ALPHA_UP = 0.05;
const float GSR_ALPHA_DOWN = 0.001;

/*
Custom Types
*/
struct SensorReadings
{
    long irValue;
    float sktRawAdc;
    float gsrAdc;
};

struct BaselineData
{
    float hr;
    float skt;
    float gsrAdjusted;
    bool valid;
};

struct TelemetryPayload
{
    float hr;
    float skt;
    float gsrAdjusted;
    float hrPercentDiff;
    float gsrPercentDiff;
    char status[16];
};

QueueHandle_t telemetryQueue;

BaselineData systemBaseline = {0, 0, 0, false};

/*
Helper Functions
*/
void programAssert(bool condition, const char *errorMsg)
{
    if (!condition)
    {
        Serial.print("[ASSERT FAIL] ");
        Serial.println(errorMsg);
        while (1)
            ;
    }
}

// Formula: Gs = ((2^n - 1) - ADC) / (ADC * Rf)
float computeRawConductance(float adcVal, float rfResistor)
{
    // return 0 early if sensor is disconnected to prevent assert crashes
    if (adcVal <= 0)
        return 0.0;

    // programAssert(adcVal < ADC_MAX_VAL, "(ADC Bounds Check) ADC value out of range");
    // programAssert(rfResistor > 0, "(Resistor Validity) Rf must be positive");

    float numerator = ADC_MAX_VAL - adcVal;
    float denominator = adcVal * rfResistor;
    return (numerator / denominator) * MICROSIEMENS_CONVERSION_FACTOR * MICROSIEMENS_CALIBRATION_FACTOR;
}

// Formula: Gs_adj = [1 - (T - 37)(0.03)]
float computeAdjustedGsr(float rawGs, float currentTemp)
{
    // programAssert(rawGs >= 0, "Negative conductance detected");
    // programAssert(currentTemp > 10.0 && currentTemp < 50.0, "Skin temperature sensor fault");

    float tempDiff = currentTemp - TEMP_BASELINE_REF;
    float correctionFactor = 1.0 - (tempDiff * TEMP_COEFF);
    return correctionFactor * rawGs;
}

// Formula: (New-Baseline)/Baseline * 100
float calculatePercentDiff(float current, float baseline)
{
    programAssert(!(isnan(current)), "[ASSERT FAIL] Current value is NaN");
    programAssert(!(isnan(baseline)), "[ASSERT FAIL] Baseline value is NaN");

    return ((current - baseline) / baseline * 100.0);
}

float computeTemperature(float rawTemp)
{
    // programAssert(rawTemp >= 0, "[ASSERT FAIL] Raw temperature ADC cannot be negative");
    // programAssert(TEMP_ANALOG_SCALING > 0, "[ASSERT FAIL] Temperature scaling constant must be positive");

    return rawTemp * TEMP_ANALOG_SCALING;
}

float computeHeartRate(long irValue)
{
    static const byte RATE_SIZE = 10;
    static byte rates[RATE_SIZE];
    static byte rateSpot = 0;
    static long lastBeat = 0;
    static float beatsPerMinute = 0;
    static int beatAvg = 0;

    static byte samplesRecorded = 0;

    programAssert(irValue >= 0, "IR value cannot be negative");
    programAssert(RATE_SIZE > 0, "Rate size must be non-zero");

    if (irValue > THRESHOLD_IR_DETECTION)
    {
        if (checkForBeat(irValue) == true)
        {
            long delta = millis() - lastBeat;
            lastBeat = millis();
            beatsPerMinute = 60.0 / (delta / 1000.0);

            if (beatsPerMinute > 40 && beatsPerMinute < 180)
            {
                rates[rateSpot++] = (byte)beatsPerMinute;
                rateSpot %= RATE_SIZE;

                if (samplesRecorded < RATE_SIZE)
                {
                    samplesRecorded++;
                }

                if (samplesRecorded == RATE_SIZE)
                {
                    beatAvg = 0;
                    for (byte x = 0; x < RATE_SIZE; x++)
                    {
                        beatAvg += rates[x];
                    }
                    beatAvg /= RATE_SIZE;
                }
                else
                {
                    beatAvg = 0;
                }
            }
        }
    }
    else
    {
        // Reset everything if the finger is removed
        beatAvg = 0;
        samplesRecorded = 0;
        rateSpot = 0;
    }

    return beatAvg;
}

SensorReadings readSensors()
{
    SensorReadings data;

    data.gsrAdc = analogRead(PIN_GSR);
    data.irValue = particleSensor.getIR();
    // data.sktRawAdc = random(66, 77);
    data.sktRawAdc = 72;

    programAssert(data.gsrAdc >= 0, "[ASSERT FAIL] GSR ADC reading is mathematically negative");
    programAssert(data.irValue >= 0, "[ASSERT FAIL] IR sensor value is mathematically negative");

    return data;
}

void calibrateBaseline()
{
    programAssert(CALIBRATION_DELAY > 0, "[ASSERT FAIL] Calibration delay must be greater than zero");

    Serial.println("[INFO] Starting Calibration. Place finger on sensor and stay still...");

    const unsigned long SENSOR_TIMEOUT = 60000;
    unsigned long timeoutStart = millis();

    long currentIr = 0;
    while (currentIr < THRESHOLD_IR_DETECTION)
    {
        if (millis() - timeoutStart > SENSOR_TIMEOUT)
        {
            Serial.println("[ERROR] Timeout waiting for finger detection.");
            systemBaseline.valid = false;
            return; // exit early, prevent infinite hang
        }
        currentIr = particleSensor.getIR();
        delay(STARTUP_DELAY);
    }

    Serial.println("[INFO] Finger detected. Acquiring heart rate lock (takes a few seconds)...");
    timeoutStart = millis(); // Reset timeout counter for the next loop

    // WAIT for the heartRate.h library to establish a valid BPM
    float tempHr = 0;
    while (tempHr <= 0)
    {
        if (millis() - timeoutStart > SENSOR_TIMEOUT)
        {
            Serial.println("[ERROR] Timeout waiting for a stable heart rate.");
            systemBaseline.valid = false;
            return; // exit early, prevent infinite hang
        }
        currentIr = particleSensor.getIR();
        tempHr = computeHeartRate(currentIr);
        delay(20);
    }

    Serial.println("[INFO] Heart rate lock acquired. Measuring baselines for 20 seconds...");

    unsigned long startTime = millis();
    int sampleCount = 0;
    float sumHr = 0;
    float sumGsr = 0;
    float sumSkt = 0;

    while (millis() - startTime < CALIBRATION_DELAY)
    {
        SensorReadings current = readSensors();
        float hr = computeHeartRate(current.irValue);

        if (hr > 0)
        {
            float temp = computeTemperature(current.sktRawAdc);
            float rawGs = computeRawConductance(current.gsrAdc, FIXED_RESISTOR_OHMS);
            float adjGs = computeAdjustedGsr(rawGs, temp);

            sumHr += hr;
            sumGsr += adjGs;
            sumSkt += temp;
            sampleCount++;
        }
    }

    programAssert(sampleCount > 0, "[ERROR] Calibration failed. Sensor lost contact.");

    programAssert(sumHr > 0, "[ERROR] Accumulated Heart Rate is zero despite having samples");

    systemBaseline.hr = sumHr / sampleCount;
    systemBaseline.gsrAdjusted = sumGsr / sampleCount;
    systemBaseline.skt = sumSkt / sampleCount;
    systemBaseline.valid = true;

    Serial.println("\n--- Calibration Complete ---");
    Serial.print("Baseline HR: ");
    Serial.println(systemBaseline.hr);
    Serial.print("Baseline GSR: ");
    Serial.println(systemBaseline.gsrAdjusted);
    Serial.print("Baseline Temp: ");
    Serial.println(systemBaseline.skt);
    Serial.println("----------------------------\n");
}

void telemetryTask(void *pvParameters)
{
    TelemetryPayload payload;

    for (;;)
    {
        if (xQueueReceive(telemetryQueue, &payload, portMAX_DELAY))
        {

            if (WiFi.status() == WL_CONNECTED)
            {
                WiFiClientSecure *client = new WiFiClientSecure;

                if (client)
                {
                    client->setInsecure();
                    HTTPClient http;

                    if (http.begin(*client, serverName))
                    {
                        http.addHeader("Content-Type", "application/json");

                        // Construct JSON payload
                        String jsonPayload = "{\"device_id\":\"" + deviceID + "\",";
                        jsonPayload += "\"hr\":" + String(payload.hr) + ",";
                        jsonPayload += "\"skt\":" + String(payload.skt) + ",";
                        jsonPayload += "\"gsr\":" + String(payload.gsrAdjusted) + ",";
                        jsonPayload += "\"gsr_diff\":" + String(payload.gsrPercentDiff) + ",";
                        jsonPayload += "\"hr_diff\":" + String(payload.hrPercentDiff) + ",";
                        jsonPayload += "\"status\":\"" + String(payload.status) + "\"}";

                        int httpResponseCode = http.POST(jsonPayload);

                        if (httpResponseCode > 0)
                        {
                            Serial.printf("[TELEMETRY] Success: %d\n", httpResponseCode);
                        }
                        else
                        {
                            Serial.printf("[TELEMETRY] Error: %s\n", http.errorToString(httpResponseCode).c_str());
                        }
                        http.end();
                    }
                    delete client;
                }
            }
        }
    }
}
/*
Program Entry Point
*/
void setup()
{
    Serial.begin(9600);
    Wire.begin(SDA_PIN, SCL_PIN);

    while (!Serial && millis() < 5000)
        ;

    Serial.println("[INFO] Starting Alersense...");

    programAssert(SDA_PIN != SCL_PIN, "[ASSERT FAIL] SDA and SCL pins cannot be the same");
    programAssert(particleSensor.begin(Wire, I2C_SPEED_FAST), "[ERROR] Heart Rate Sensor failed to initialize");

    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeIR(0x24);
    particleSensor.setPulseAmplitudeGreen(0);

    Serial.println("[INFO] Initializing WiFi...");

    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    WiFi.disconnect(true, true);
    delay(200);

    const int MAX_RETRIES = 8;
    const unsigned long CONNECT_TIMEOUT_MS = 15000;

    bool wifiConnected = false;

    for (int attempt = 1; attempt <= MAX_RETRIES && !wifiConnected; attempt++) {
        Serial.printf("[INFO] WiFi attempt %d/%d to SSID: %s\n", attempt, MAX_RETRIES, ssid);

        WiFi.begin(ssid, password);
        WiFi.setTxPower(WIFI_POWER_8_5dBm);  // try up to WIFI_POWER_11dBm if need more range, but WIFI_POWER_8_5dBm worked in the vid demo.
        delay(1000);                           

        unsigned long startTime = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - startTime < CONNECT_TIMEOUT_MS) {
            delay(500);
            Serial.print(".");
            if (millis() % 2000 < 100) Serial.printf(" (status=%d)", WiFi.status());
        }

        if (WiFi.status() == WL_CONNECTED) {
            wifiConnected = true;
        } else {
            Serial.println("\n[WARN] Timeout - disconnecting and retrying...");
            WiFi.disconnect(true);
            delay(2000);
        }
    }

    if (wifiConnected) {
        WiFi.setSleep(false);  
        Serial.println("\n[INFO] Connected to WiFi!");
        Serial.print("[INFO] IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("[INFO] RSSI: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println("\n[ERROR] Could not connect after all retries. Halting.");
        while (1) {
            delay(1000);
            Serial.print(".");
        }
    }

    telemetryQueue = xQueueCreate(10, sizeof(TelemetryPayload));

    xTaskCreatePinnedToCore(
        telemetryTask,    // Function to implement the task
        "Telemetry Task", // Name of the task
        8192,             // Stack size in words
        NULL,             // Task input parameter
        1,                // Priority of the task
        NULL,             // Task handle
        0                 // Core where the task should run
    );
    Serial.println("[INFO] HTTP Stack initialized.");

    calibrateBaseline();
    Serial.println("[INFO] Application startup complete. Entering main loop.");
}

void loop()
{

    if (!systemBaseline.valid)
    {
        Serial.println("[ERROR] Invalid baseline, stopping.");
        while (1)
            ; // Halt
    }

    SensorReadings current = readSensors();

    if (current.gsrAdc < 100)
    {
        Serial.println("[WARNING] GSR sensor lost contact. Please adjust finger.");
        delay(500);
        return;
    }

    float currentSkt = computeTemperature(current.sktRawAdc);
    float currentHr = computeHeartRate(current.irValue);
    float currentRawGs = computeRawConductance(current.gsrAdc, FIXED_RESISTOR_OHMS);
    float currentAdjustedGs = computeAdjustedGsr(currentRawGs, currentSkt);

    programAssert(currentHr >= 0, "[ASSERT FAIL] Computed Heart Rate is negative");
    programAssert(currentAdjustedGs >= 0, "[ASSERT FAIL] Computed Adjusted GSR is negative");

    // calculate drops ONLY if a valid heartbeat is detected to prevent zero-division/noise
    if (currentHr > 0)
    {
        float hrPercentDiff = calculatePercentDiff(currentHr, systemBaseline.hr);
        float gsrPercentDiff = calculatePercentDiff(currentAdjustedGs, systemBaseline.gsrAdjusted);

        bool hrDrop = hrPercentDiff < THRESH_HR_PERCENT;
        bool gsrDrop = gsrPercentDiff < THRESHOLD_GSR_PERCENT;

        String status = (hrDrop && gsrDrop) ? "Inattentive" : "Attentive";
        static unsigned long lastTelemetryTime = 0;
        const unsigned long TELEMETRY_INTERVAL = 5000;

        if (millis() - lastTelemetryTime > TELEMETRY_INTERVAL)
        {
            TelemetryPayload newPayload;
            newPayload.hr = currentHr;
            newPayload.skt = currentSkt;
            newPayload.gsrAdjusted = currentAdjustedGs;
            newPayload.hrPercentDiff = hrPercentDiff;
            newPayload.gsrPercentDiff = gsrPercentDiff;
            strlcpy(newPayload.status, status.c_str(), sizeof(newPayload.status));

            if (xQueueSend(telemetryQueue, &newPayload, 0) != pdPASS)
            {
                Serial.println("[WARNING] Telemetry queue full, dropping packet.");
            }

            lastTelemetryTime = millis();
        }

        Serial.print("HR (BPM): ");
        Serial.print(currentHr);
        Serial.print(" | HR Diff: ");
        Serial.print(hrPercentDiff);
        Serial.print(" | GSR: ");
        Serial.print(currentAdjustedGs);
        Serial.print(" | GSR Diff: ");
        Serial.print(gsrPercentDiff);
        Serial.print("| Temp: ");
        Serial.print(currentSkt);
        Serial.println("C");

        float currentAlpha = (currentAdjustedGs > systemBaseline.gsrAdjusted) ? GSR_ALPHA_UP : GSR_ALPHA_DOWN;
        systemBaseline.gsrAdjusted = (currentAdjustedGs * currentAlpha) + (systemBaseline.gsrAdjusted * (1.0 - currentAlpha));
    }
    else
    {
        Serial.print("[WAITING] IR: ");
        Serial.print(currentHr);
        Serial.print(" | GSR ADC: ");
        Serial.println(currentAdjustedGs);
    }
}