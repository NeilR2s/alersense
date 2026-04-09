# Raspberry Pi 4 Setup Guide (Data-Hub)
*For Beginners*

This guide will walk you through setting up the AI Model (Data-Hub) on your Raspberry Pi 4. Don't panic if you've never coded or used a terminal before, just follow the steps below exactly.

## How to use this guide
- **The Terminal:** The "Terminal" is where you type commands to talk to your Raspberry Pi. To open it, click the black `>_` icon at the top of your screen, or press `Ctrl + Alt + T` on your keyboard.
- **Copy and Paste:** It is highly recommended to copy the commands from this guide and paste them into your terminal. To paste in the terminal, you can usually **Right-Click** and select **Paste**, or press `Ctrl + Shift + V`.
- Press the **Enter** key after pasting each command to run it.

---

## Step 1: Check your Raspberry Pi OS
RPi 4 needs the **64-bit** version of the Raspberry Pi Operating System to work. make sure you have it.

1. Open your terminal.
2. Copy, paste, and run this command:
   ```bash
   uname -m
   ```
3. Look at what it prints out on the next line:
   - If it says **`aarch64`**, you have a 64-bit OS. Move on to Step 2.
   - If it says **`armv7l`** or anything else, you have a 32-bit OS. **Stop here.** The software will crash. You need to reinstall your Raspberry Pi SD Card with the `64-bit` OS using the official Raspberry Pi Imager.

## Step 2: Install System Requirements
We need to install some basic background tools that handle the camera.

1. Run this command to update your system's list of apps. *(It might ask for your password. When you type your password, nothing will show up on screen, this is for security, it hides your password. Just type it and press Enter).*
   ```bash
   sudo apt-get update
   ```
2. Now, install the required camera tools:
   ```bash
   sudo apt-get install -y libgl1-mesa-glx libglib2.0-0
   ```
3. Give yourself permission to use the plugged-in camera:
   ```bash
   sudo usermod -aG video $USER
   ```
*(Note: You might need to restart your Raspberry Pi later for the camera permission to fully take effect if the camera doesn't turn on).*

## Step 3: Go to the Project Folder
We need to tell the terminal to look inside the folder where the AI code lives. The easiest way to do this without getting lost is:

1. Open your **File Manager** (the yellow folder icon at the top of your screen).
2. Double-click through your folders until you find the `LPU-ALERSENSE` folder. 
3. Go inside it, and then double-click the `data-hub` folder.
4. **Right-click** on any empty white space inside this folder window, and click **"Open in Terminal"**. 

A new terminal will pop up, and you will be exactly where you need to be!

## Step 4: Create a "Virtual Environment"
A virtual environment is like a sandbox. It keeps our code's files separate from the rest of your Raspberry Pi so nothing gets messy.

1. Create the sandbox:
   ```bash
   python3 -m venv rpi-env
   ```
   *(This might take a minute or even more, just wait until the terminal lets you type again).*
2. **"Enter" the sandbox.** You have to do this every time you open a new terminal to run the code:
   ```bash
   source rpi-env/bin/activate
   ```
   *(You will know it worked because you will see `(rpi-env)` appear at the very left of your typing line).*

## Step 5: Install the AI Code
Now we download the brain of the AI into our sandbox.

1. Make sure you still see `(rpi-env)` on the left.
2. Run these commands:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
   *(This step downloads a lot of things from the internet and can take 10-40 minutes. Just chill for a bit first, and check on it from time to time.)*

## Step 6: Setup the Configuration File
The AI needs to know where to send its data. We do this by editing a settings file called `.env`. If you dont have it, ask the dev to send you a copy.

1. Copy our template file to make a real one:
   ```bash
   cp .env.sample .env
   ```
2. We will edit this file using a simple text editor called `nano`:
   ```bash
   nano .env
   ```
3. Use your **arrow keys** to move the blinking cursor. Change the text to match your server's IP address (for example, change it to look like `SERVER_URL=http://192.168.1.100:8000`).
4. **How to save and exit:**
   - Press **`Ctrl` and `X`** on your keyboard at the same time.
   - It will ask if you want to save at the bottom. Press **`Y`**.
   - It will ask what file name to save as. Just press **`Enter`**.

## Step 7: Run the Application!
Make sure your USB Webcam is plugged in.

1. Run the AI:
   ```bash
   python main.py
   ```

---

## Troubleshooting: The "Illegal Instruction" Error

Sometimes, when you try to run `python main.py` in Step 7, it instantly crashes and the terminal prints **`Illegal instruction`** or **`Illegal instruction (core dumped)`**. 

This happens because the Raspberry Pi 4 gets confused by some of the complex math instructions in the AI library.

**The Fix:**
Instead of running `python main.py`, run this exact command instead:
```bash
OPENBLAS_CORETYPE=ARMV8 python main.py
```

If that fixes it and you want to make the fix permanent (so you don't have to type all that extra text every time), run this command just once:
```bash
echo "export OPENBLAS_CORETYPE=ARMV8" >> ~/.bashrc
```
Then close your terminal, open a new one, go back into the sandbox (Step 4, part 2), and try running `python main.py` normally again.

## Heat Warning!
The Raspberry Pi 4 gets very hot when running AI. If it gets too hot, it will slow down dramatically to protect itself. Please ensure you have a small fan or a metal heatsink attached to your Pi.
IF you can poke some holes for the black box thing, maybe put a fan in it.