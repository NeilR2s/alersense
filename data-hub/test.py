"""
{0: 'looking_away', 1: 'looking_forward', 2: 'phone_use', 3: 'raising_hand', 4: 'reading_writing', 5: 'sleeping', 6: 'standing', 7: 'talking'}

"""

import cv2
from ultralytics import YOLO

model = YOLO("./models/last_ncnn_model")
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Error: Could not open webcam.")
    exit()

print("Starting video feed... Press 'q' to exit.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame")
        break

    results = model(frame, stream=True)

    for r in results:
        annotated_frame = r.plot()

    cv2.imshow("Alersnse Webcam Testing", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
