// const int PIN_HR = 
// const int PIN_SKT = 
const int PIN_GSR = A2;

// const float ADC_MAX_VAL = 4095;
const float ADC_MAX_VAL = 1023.0;
const float FIXED_RESISTOR_OHMS = 5000.0;
const float TEMP_BASELINE_REF = 37;
const float TEMP_COEFF = 0.03;

const float THRESHOLD_GSR_PERCENT = -9.49;
const float THRESH_HR_PERCENT = -3.98;

struct SensorReadings {
  float hrBpm;
  float sktCelsius;
  float gsrAdc;
};

struct BaselineData {
  float hr;
  float skt;
  float gsrAdjusted;
  bool valid;
};

void programAssert(bool condition, const char* errorMsg){
  if (!condition) {
    Serial.print("[ASSERT FAIL]");
    Serial.println(errorMsg);
  }
  return;
};

// Formula: Gs = ((2^n - 1) - ADC) / (ADC * Rf)
float computeRawConductance(float adcVal, float rfResistor){
  programAssert(adcVal>0 && adcVal < ADC_MAX_VAL, "(ADC Bounds Check) ADC value out of range");
  programAssert(rfResistor > 0, "(Resistor Validity) Rf must be positive");

  float numerator = ADC_MAX_VAL - adcVal;
  float denominator = adcVal * rfResistor;

  return numerator/denominator;
}

// Formula: Gs_adj = [1 - (T - 37)(0.03)]
float computeAdjustedGsr(float rawGs, float currentTemp){
  programAssert(rawGs>=0, "Negative conductance detected");
  programAssert(currentTemp>10.0 && currentTemp <50.0, "Skin temperature sensor fault");

  float tempDiff = currentTemp - TEMP_BASELINE_REF;
  float correctionFactor = 1.0 - (tempDiff * TEMP_COEFF);

  return correctionFactor * rawGs;
}

// Formula: (New-Baseline)/Baseline * 100
float calculatePercentDiff(float current, float baseline){
  programAssert(baseline !=0.0, "Baseline is zero (zero division error)");
  programAssert(!(isnan(current)), "Current value is NaN");

  return ((current-baseline)/baseline * 100.0);
}

SensorReadings readSensors(){
  SensorReadings data;

  data.gsrAdc = analogRead(PIN_GSR);
  data.hrBpm = random(30, 140);
  data.sktCelsius = random(32, 42);

  programAssert(data.gsrAdc > 100, "GSR sensor disconnected or unused (ensure proper skin contact).");

  return data;
}

BaselineData systemBaseline = {0, 0, 0, false};

void setup() {
  Serial.begin(9600);
  while(!Serial && millis() <3000);
  Serial.println("[INFO] Starting Alersense...");

  Serial.println("[INFO] Capturing baseline...");
  delay(2000);
  SensorReadings rawInit = readSensors();

  float rawGs = computeRawConductance(rawInit.gsrAdc, FIXED_RESISTOR_OHMS);
  float adjustedGs = computeAdjustedGsr(rawGs, rawInit.sktCelsius);

  // systemBaseline.hr = rawInit.hrBpm;
  systemBaseline.hr = 70;
  systemBaseline.skt = 32;
  // systemBaseline.skt = rawInit.sktCelsius;
  systemBaseline.gsrAdjusted = adjustedGs;
  systemBaseline.valid = true;

  Serial.println("[INFO] Baseline established. Application startup complete.");
}

void loop() {
  if (!systemBaseline.valid) {
  Serial.println("[ERROR] Invalid baseline, stopping.");
  }

  SensorReadings current = readSensors();

  float currentRawGs = computeRawConductance(current.gsrAdc, FIXED_RESISTOR_OHMS);
  float currentAdjustedGs = computeAdjustedGsr(currentRawGs, current.sktCelsius);

  float hrPercentDiff = calculatePercentDiff(current.hrBpm, systemBaseline.hr);
  float gsrPercentDiff = calculatePercentDiff(currentAdjustedGs, systemBaseline.gsrAdjusted);

  bool hrDrop = hrPercentDiff > THRESH_HR_PERCENT;
  bool gsrDrop = currentAdjustedGs > THRESH_HR_PERCENT;
  
  if (hrDrop && gsrDrop){
    Serial.println("[STATUS] Inattentive");
    Serial.print(" | HR Diff: ");
    Serial.print(hrPercentDiff);
    Serial.print(" | GSR Diff: ");
    Serial.print(gsrPercentDiff);
  } else {
    Serial.println("[STATUS Attentive]");
    Serial.print(" | HR Diff: ");
    Serial.print(hrPercentDiff);
    Serial.print(" | GSR Diff: ");
    Serial.print(gsrPercentDiff);
  }

  // Serial.println("[DEBUG]");
  // Serial.print(" Temp: ");
  // Serial.print(current.sktCelsius);
  // Serial.print(" | GSR: ");
  // Serial.print(current.gsrAdc);
  // Serial.print(" | BPM: ");
  // Serial.print(current.hrBpm);

  delay(800);
}






