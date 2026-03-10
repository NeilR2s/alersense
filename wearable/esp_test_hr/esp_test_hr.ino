#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

#define SDA_PIN 10
#define SCL_PIN 9

/*
This is for testing the HR sensor only. Set PLOTTER_MODE to false if you want to see the raw BPM,
and set PLOTTER_MODE to true to visualize the "heartbeat" in the Arduino IDE serial plotter.
*/

const bool PLOTTER_MODE = false;

MAX30105 particleSensor;

const byte RATE_SIZE = 10;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute = 0;
int beatAvg = 0;

void setup()
{
    Serial.begin(115200);
    delay(1000);

    Wire.begin(SDA_PIN, SCL_PIN);

    Wire.setClock(400000);

    if (PLOTTER_MODE == false)
    {
        Serial.println("Initializing MAX30105...");
    }

    if (!particleSensor.begin(Wire, I2C_SPEED_FAST))
    {
        Serial.println("MAX30102 not found! Check wiring/power/pullups.");
        while (1)
            ;
    }

    particleSensor.setup();

    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeIR(0x24);
    particleSensor.setPulseAmplitudeGreen(0);
}

void loop()
{
    long irValue = particleSensor.getIR();

    // No finger on the sensor
    if (irValue > 50000)
    {

        if (checkForBeat(irValue) == true)
        {
            long delta = millis() - lastBeat;
            lastBeat = millis();

            beatsPerMinute = 60 / (delta / 1000.0);

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

        if (PLOTTER_MODE == true)
        {
            Serial.println(irValue);
        }
        else
        {
            Serial.print("IR: ");
            Serial.print(irValue);
            Serial.print("\t BPM: ");
            Serial.print(beatsPerMinute);
            Serial.print("\t Avg BPM: ");
            Serial.println(beatAvg);
        }
    }
    else
    {
        if (PLOTTER_MODE == false)
        {
            Serial.println("No finger detected. Please place your finger gently on the sensor.");
            delay(500);
        }
    }
}