# AgriMind Smart Farm — Flash Guide (portable)

Copy this whole folder (`agrimind_smart_farm/`) to any machine and flash the
ESP32. It contains everything: the sketch, the web portal, and these steps.

**Files in this folder**
- `agrimind_smart_farm.ino` — the firmware
- `web_portal.h` — on-device Wi-Fi setup page (must stay next to the .ino)
- `FLASH_GUIDE.md` — this file

---

## ⚠️ The two gotchas we hit (read first)

This board is a **26 MHz-crystal ESP32 clone**, which means:

1. **Upload at 115200, not the default.** The fast default (921600) fails with
   *"The chip stopped responding."* Use `UploadSpeed=115200`.
2. **View the serial monitor at `74880` baud, not 115200.** At 115200 you get
   garbage (`b4 b4 b4…`). This does **not** affect the device's real operation or
   the data it sends to the dashboard — only the debug serial.

---

## Option A — Arduino IDE (easiest on another machine)

1. Install **Arduino IDE 2.x**.
2. **Boards Manager** → install **“esp32 by Espressif Systems.”**
3. **Library Manager** → install **“LiquidCrystal I2C”** (by Frank de Brabander).
4. Open `agrimind_smart_farm.ino` (keep `web_portal.h` in the same folder).
5. **Tools → Board →** `ESP32 Dev Module`.
6. **Tools → Upload Speed →** `115200`.
7. **Tools → Port →** your USB port (e.g. `/dev/cu.usbserial-0001`, or `COMx` on Windows).
8. Click **Upload**. If it says *“Connecting…….”* and stalls, **hold the BOOT
   button** on the board until it starts writing, then release.
9. **Tools → Serial Monitor →** set baud to **74880** to watch readings.

## Option B — arduino-cli (what we used)

```bash
# one-time
arduino-cli core install esp32:esp32
arduino-cli lib install "LiquidCrystal I2C"

# find the port
arduino-cli board list        # look for /dev/cu.usbserial-*  (or COMx)

# compile
arduino-cli compile --fqbn esp32:esp32:esp32 agrimind_smart_farm

# upload  ← note UploadSpeed=115200
arduino-cli upload -p /dev/cu.usbserial-0001 \
  --fqbn esp32:esp32:esp32:UploadSpeed=115200 agrimind_smart_farm

# monitor  ← note 74880
arduino-cli monitor -p /dev/cu.usbserial-0001 --config baudrate=74880
```

If upload stalls at “Connecting…”, hold **BOOT**, tap **EN/RST**, release EN,
keep holding BOOT until writing starts, then release.

---

## First boot — connect Wi-Fi (no hard-coded network)

1. On power-up the board raises its own hotspot **`AgriMind-XXXX`**
   (password `agrimind123`) and the LCD shows the setup IP.
2. Join that hotspot from a phone → the setup page opens (or go to
   `http://192.168.4.1`).
3. **Wi-Fi tab → Scan → pick your network → Connect.** Add **several** networks
   (e.g. `CANALBOX-4468-2G` + a phone hotspot) — it saves up to 8 and
   auto-reconnects to whichever is in range. ESP32 is **2.4 GHz only**.
4. The board auto-pairs with AgriMind; claim it in the app to bind a section.

## Seeing readings every ~5 s
- **LCD** on the board (updates ~2 s).
- **Device web page:** `http://<board-ip>/` or `http://<board-ip>/api/status`.
- **AgriMind dashboard:** polls every 5 s; the board posts every 5 s
  (`DEFAULT_INTERVAL_S = 5`). Change it any time in the portal → Settings.

## Pump / relay (the "water won't stop" fix)
- Pump logic: **ON < 40 %** moisture, **OFF > 65 %** (hysteresis in between).
- If the pump never stops when moisture reads 100 %, the relay wiring is the
  issue, **not** the code:
  - Wire the pump through **COM → NO** (Normally-Open), *not* NC.
  - Give the pump its **own power supply**, switched by the relay contacts.
  - Share **GND** between the ESP32 and the relay module.
  - If your relay is active-HIGH, invert the two `digitalWrite(RELAY_PIN, …)`
    levels in `controlPump()` and `setup()`.

## Power tip
Use a **good USB cable + a powered port** (or a proper 5 V supply). A weak
cable/port can brown-out the board and make it look like it only boots and
resets. The sketch disables the brown-out detector, but clean 5 V still matters.
