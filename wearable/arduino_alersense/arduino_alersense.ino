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
const String deviceID = "ALRSNS_01";

/*
Arduino Hardware Configs
*/
const int PIN_GSR = 0;
const int SDA_PIN = 10;
const int SCL_PIN = 9;
MAX30105 particleSensor;

/*
Hardware Magic Number Configs
*/
const int POLLING_DELAY = 450;
const int CALIBRATION_DELAY = 20000;
const int STARTUP_DELAY = 300;
const int WIRE_CLOCK = 100000;
const float ADC_MAX_VAL = 6095.0; // this is a hacky solution, but it works for now
const float FIXED_RESISTOR_OHMS = 5000.0;
const float TEMP_BASELINE_REF = 37.0;
const float TEMP_COEFF = 0.03;

const float THRESHOLD_GSR_PERCENT = -9.49;
const float THRESH_HR_PERCENT = -3.98;
const float TEMP_ANALOG_SCALING = 0.488;
const long THRESHOLD_IR_DETECTION = 25000;

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

    programAssert(adcVal < ADC_MAX_VAL, "(ADC Bounds Check) ADC value out of range");
    programAssert(rfResistor > 0, "(Resistor Validity) Rf must be positive");

    float numerator = ADC_MAX_VAL - adcVal;
    float denominator = adcVal * rfResistor;
    return numerator / denominator;
}

// Formula: Gs_adj = [1 - (T - 37)(0.03)]
float computeAdjustedGsr(float rawGs, float currentTemp)
{
    programAssert(rawGs >= 0, "Negative conductance detected");
    programAssert(currentTemp > 10.0 && currentTemp < 50.0, "Skin temperature sensor fault");

    float tempDiff = currentTemp - TEMP_BASELINE_REF;
    float correctionFactor = 1.0 - (tempDiff * TEMP_COEFF);
    return correctionFactor * rawGs;
}

// Formula: (New-Baseline)/Baseline * 100
float calculatePercentDiff(float current, float baseline)
{
    // check for floating point zeroes to prevent divide-by-zero crashes
    if (abs(baseline) < 0.001)
        return 0.0;

    programAssert(!(isnan(current)), "[ASSERT FAIL] Current value is NaN");
    programAssert(!(isnan(baseline)), "[ASSERT FAIL] Baseline value is NaN");

    return ((current - baseline) / baseline * 100.0);
}

float computeTemperature(float rawTemp)
{
    programAssert(rawTemp >= 0, "[ASSERT FAIL] Raw temperature ADC cannot be negative");
    programAssert(TEMP_ANALOG_SCALING > 0, "[ASSERT FAIL] Temperature scaling constant must be positive");

    return rawTemp * TEMP_ANALOG_SCALING;
}

float computeHeartRate(long irValue)
{
    static const byte RATE_SIZE = 4;
    static byte rates[RATE_SIZE];
    static byte rateSpot = 0;
    static long lastBeat = 0;
    static float beatsPerMinute = 0;
    static int beatAvg = 0;

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

                beatAvg = 0;
                for (byte x = 0; x < RATE_SIZE; x++)
                {
                    beatAvg += rates[x];
                }
                beatAvg /= RATE_SIZE;
            }
        }
    }
    else
    {
        beatAvg = 0;
    }
    return beatAvg;
}

SensorReadings readSensors()
{
    SensorReadings data;

    data.gsrAdc = analogRead(PIN_GSR);
    data.irValue = particleSensor.getIR();
    // data.sktRawAdc = analogRead(PIN_SKT);
    data.sktRawAdc = 37;

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
        delay(STARTUP_DELAY);
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

/*
Program Entry Point
*/
void setup()
{
    Serial.begin(9600);

#if defined(ESP32) || defined(ESP8266)
    Wire.begin(SDA_PIN, SCL_PIN);
#else
    Wire.begin();
#endif

    while (!Serial && millis() < 5000)
        ;

    Serial.println("[INFO] Starting Alersense...");

    programAssert(SDA_PIN != SCL_PIN, "[ASSERT FAIL] SDA and SCL pins cannot be the same");

    programAssert(particleSensor.begin(Wire, I2C_SPEED_STANDARD), "[ERROR] Heart Rate Sensor failed to initialize");

    // particleSensor.setup(0x1F, 4, 2, 100, 411, 4096);
    particleSensor.setup(0x71, 4, 2, 100, 411, 4096);
    particleSensor.setPulseAmplitudeRed(0x1F);
    particleSensor.setPulseAmplitudeIR(0x1F);
    particleSensor.setPulseAmplitudeGreen(0);

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\n[INFO] Connected to WiFi network");

    calibrateBaseline();
    Serial.println("[INFO] Application startup complete. Entering main loop.");
}

void loop()
{
    programAssert(POLLING_DELAY > 0, "[ASSERT FAIL] Polling delay must be strictly positive");

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

        // Serial.print(" | HR Diff: ");
        // Serial.print(hrPercentDiff);
        // Serial.print("% | GSR Diff: ");
        // Serial.print(gsrPercentDiff);
        // Serial.println("%");
        if (WiFi.status() == WL_CONNECTED)
        {
            // Use a pointer for WiFiClientSecure to manage memory manually
            WiFiClientSecure *client = new WiFiClientSecure;

            if (client)
            {
                client->setInsecure(); // <--- This allows HTTPS without a Root CA certificate

                HTTPClient http;
                // Pass the secure client into the begin method
                if (http.begin(*client, serverName))
                {
                    http.addHeader("Content-Type", "application/json");

                    // Your manual JSON string
                    String jsonPayload = "{\"device_id\":\"" + deviceID + "\",";
                    jsonPayload += "\"status\":\"" + status + "\",";
                    jsonPayload += "\"hr_diff\":" + String(hrPercentDiff) + ",";
                    jsonPayload += "\"gsr_diff\":" + String(gsrPercentDiff) + "}";

                    int httpResponseCode = http.POST(jsonPayload);

                    if (httpResponseCode > 0)
                    {
                        Serial.printf("HTTP Response code: %d\n", httpResponseCode);
                    }
                    else
                    {
                        Serial.printf("Error: %s\n", http.errorToString(httpResponseCode).c_str());
                    }
                    http.end();
                }
                delete client; // Free memory
            }
        }
        // if(WiFi.status() == WL_CONNECTED){
        //     HTTPClient http;
        //     http.begin(serverName);
        //     http.addHeader("Content-Type", "application/json");

        //     Serial.print("Sending Payload: ");
        //     Serial.println(jsonPayload);
        //     int httpResponseCode = http.POST(jsonPayload);

        //     if (httpResponseCode <= 0) {
        //         Serial.print("HTTP Error code: ");
        //         Serial.println(httpResponseCode);
        //     }
        //     http.end();
        // } else {
        //     Serial.println("WiFi Disconnected. Cannot send telemetry.");
        // }

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
    delay(100);
}