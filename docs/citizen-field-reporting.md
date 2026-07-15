# PVO Hunter - Mobile Citizen Field Reporting

## Overview

The PVO Hunter is a Pokémon GO-style GPS proximity detector built into the PoPV mobile app. Citizens physically walk to project sites, and the app auto-detects when they're within 100 meters of a PVO. Only then can they submit GPS-verified field reports on-chain.

## How It Works

1. **Open the map** - Hunter activates automatically on the Map tab
2. **Walk near a PVO** - GPS monitors continuously in the background
3. **Auto-detect at 100m** - Alarm, vibration, and drawer pop-up when within radius
4. **View project details** - Distance, title, budget, municipality shown
5. **Submit field report** - GPS-locked, photo evidence via IPFS, signed by wallet

## Detection Flow

```
Map loads → Fit all PVO pins → GPS stream starts → Poll every 3 seconds
                                                          ↓
                                              Haversine distance check
                                                          ↓
                                          Within 100m of any PVO?
                                          ↓ yes                    ↓ no
                                    Sound alert + haptics        Keep scanning
                                    Smooth zoom to user+PVO
                                    Hunter drawer auto-expands
                                    System notification fires
```

## Field Report Screen

### GPS Lock
- Acquires high-accuracy GPS position on screen open
- Shows green "GPS Locked" with coordinates when ready
- Button disabled until GPS locked

### Photo Evidence
- **Take Photo** - opens device camera
- **Gallery** - pick from photo library
- Image preview shown before upload
- **Upload to IPFS** - sends base64 to `/api/upload-ipfs`, pinned on Pinata
- IPFS hash shown as monospace text on success

### On-Chain Submission
- Milestone selector (M1, M2, M3)
- Observations/notes field
- Submit button signs with wallet's Ed25519 key locally
- Transaction built via `/api/build-tx`, signed locally, submitted to Soroban
- IPFS hash recorded as `data_hash` in the Community Oracle contract

## Gate-Aware Reporting

- Field report pings `/api/pvos` every 5 seconds while screen is open
- Shows green "Gates 1 & 2 Passed" when engineer + compliance approved
- Submit button remains disabled until both gates pass
- Citizen can wait on-screen for gates to clear, then submit immediately

## Anti-Spoofing

- **GPS proximity check** - "Submit Field Report" button only visible within 100m of PVO
- **IP geolocation integrity** - compares GPS coordinates to IP-derived city
- **Haversine formula** - calculates great-circle distance between user and PVO
- **Wallet signing** - every report signed with citizen's Ed25519 key
- **XDR signing** - secret key never leaves the device, only signature transmitted

## Technical Details

| Component | Technology |
|-----------|-----------|
| Map rendering | `flutter_map` + CartoDB tiles |
| GPS tracking | `geolocator` (best accuracy, 2m filter) |
| Proximity calculation | Haversine formula (6371km Earth radius) |
| Detection radius | 100 meters |
| Photo capture | `image_picker` (camera + gallery) |
| IPFS pinning | Pinata via `/api/upload-ipfs` |
| Transaction signing | Ed25519 via `cryptography` package |
| On-chain submission | Community Oracle `submit_report` via Soroban |
| Gate status | `/api/pvos` polling every 10s (map) + 5s (report screen) |
| Background monitoring | `StreamSubscription<Position>` + `Timer.periodic` |
| Notifications | `flutter_local_notifications` + `SystemSound.alert` |
