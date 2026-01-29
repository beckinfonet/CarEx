# CarEx - Mobile Car Marketplace

A modern React Native application for buying and selling cars, built with a Node.js/MongoDB backend and AWS S3 integration.

## 📱 Project Status

### ✅ Completed
*   **Core Architecture**
    *   React Native project setup (0.73+)
    *   Navigation (Stack Navigator)
    *   Theme System (Dark Mode, Business Blue Accent)
    *   Centralized Configuration (`src/constants/config.ts`)
*   **UI/UX**
    *   Home Screen (Search, Category Filters, Car List)
    *   Car Details Screen (Image Carousel, Specs, Description)
    *   Sell Car Screen (Form, Image Picker, Inline Dropdowns)
    *   Components: `SearchBar`, `FilterBar`, `CategoryList`, `CarCard`, `BottomBar`, `MoreMenu`
    *   **Vector Icons**: Replaced all emojis with Lucide React Native icons
    *   **Logo**: Custom vector logo integrated into Header
*   **Backend & Data**
    *   Node.js/Express Server
    *   MongoDB Cloud Integration
    *   AWS S3 Image Storage
    *   API: `GET /api/cars` (Fetch listings)
    *   API: `POST /api/cars` (Create listing with multiple images)
    *   Dynamic Schema: Supports Engine, Transmission, Condition, etc.
*   **Features**
    *   Interactive Category Filtering
    *   Call Seller (Linking API)
    *   Pull-to-Refresh
    *   Multi-image Upload

### 🚧 Pending (App Store Prep)
*   **Deployment**
    *   [x] Deploy Backend to Public Cloud (AWS EC2/Render/Heroku)
    *   [x] Update `src/constants/config.ts` with Production URL
*   **Compliance & Assets**
    *   [x] Generate App Icons (`AppIcon.appiconset`) from `assets/logo.svg`
    *   [ ] Create Launch Screen (Splash)
    *   [ ] Review `Info.plist` Permission Strings (Camera/Photo Library)
    *   [ ] Terms of Service & Privacy Policy Links
    *   [ ] User Reporting/Blocking (UGC Compliance)
*   **Features**
    *   [ ] Offline Mode Handling (NetInfo)
    *   [ ] User Authentication (Login/Register)
    *   [ ] Favorites Persistence

## 🛠 Tech Stack
*   **Frontend**: React Native, TypeScript, React Navigation, Axios, Lucide Icons, React Native SVG
*   **Backend**: Node.js, Express, Mongoose (MongoDB), AWS SDK (S3), Multer
*   **Infrastructure**: AWS S3 (Images), MongoDB Atlas (Database)

## 🚀 Getting Started

### 1. Prerequisites
*   Node.js >= 18
*   CocoaPods (for iOS)
*   MongoDB Cluster
*   AWS S3 Bucket

### 2. Backend Setup
```bash
cd backend-services/carEx-services
# Create .env file with:
# PORT=5001
# MONGODB_URI=...
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_REGION=...
# AWS_BUCKET_NAME=...

npm install
node server.js
```

### 3. Frontend Setup
```bash
cd carEx
npm install
cd ios && pod install && cd ..

# Run iOS
npm run ios

# Run Android
npm run android
```

## 🎨 Asset Generation
The source logo is available at `assets/logo.svg`. Use this to generate your App Icons and Splash Screen.
