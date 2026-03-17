# Phone Verification Setup

Phone verification uses the **backend API** (same pattern as Firebase Auth – REST APIs, no native SDK). No Firebase SDK or native modules are required.

## How It Works

1. User taps "Verify Phone" → app calls `POST /api/otp/send` with their phone number
2. Backend generates a 6-digit code and either:
   - **Twilio configured**: Sends real SMS
   - **Twilio not configured**: Logs code to console (for dev/testing)
3. User enters code → app calls `POST /api/otp/verify` → backend sets `isPhoneVerified: true`

## Production: Enable Real SMS (Twilio)

1. Create a [Twilio](https://www.twilio.com/) account
2. Get your **Account SID**, **Auth Token**, and a **Phone Number**
3. Add to backend `.env`:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

4. Install backend deps: `cd backend-services/carEx-services && npm install`
5. Restart the backend

## Development (No Twilio)

Without Twilio, the backend logs the code to the console:

```
[OTP] Code for +821012345678: 123456 (Twilio not configured - add to .env for real SMS)
```

Use that code to verify. For quick testing, code `123456` always works (see backend OTP verify logic).
