#include <Wire.h>
#define SDA_PIN 7
#define SCL_PIN 8
#define MAX30205_ADDR 0x4C

void setup()
{
    Serial.begin(115200);
    Wire.begin(SDA_PIN, SCL_PIN);

    Wire.beginTransmission(MAX30205_ADDR);
    Wire.write(0x01);
    Wire.write(0x00);
    Wire.endTransmission();

    Serial.println("MAX30205 Temperature Sensor");
}

float readTemperature()
{
    Wire.beginTransmission(MAX30205_ADDR);
    Wire.write(0x00);
    Wire.endTransmission();

    Wire.requestFrom(MAX30205_ADDR, 2);
    if (Wire.available() == 2)
    {
        uint8_t msb = Wire.read();
        uint8_t lsb = Wire.read();

        uint16_t rawData = (uint16_t)msb << 8 | lsb;
        int16_t tempRaw = (int16_t)rawData;

        return ((float)tempRaw * 0.00390625) + 64.0;
    }
    return -999;
}

void loop()
{
    float temp = readTemperature();
    Serial.print("Temperature: ");
    Serial.print(temp);
    Serial.println(" °C");

    delay(1000);
}