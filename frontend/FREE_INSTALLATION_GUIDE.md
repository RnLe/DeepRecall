# Free iOS App Installation Guide

How to install DeepRecall on your iPad without paying $99/year for Apple Developer account.

## 🆓 Method 1: Free Apple Developer Account (Recommended)

**Cost**: FREE  
**App Duration**: 7 days (then reinstall)  
**Setup Time**: 5 minutes  

### Steps:

1. **Get a Mac** (cloud service, borrowed, etc.)
2. **Download Xcode** from App Store (free)
3. **Sign in to Xcode** with your Apple ID (free account)
4. **Connect iPad** via USB
5. **Open your project** in Xcode
6. **Select your iPad** as target device
7. **Click ▶️ Run** - app installs directly!

### Important Notes:
- ✅ **Works immediately** - no approval needed
- ✅ **Full app functionality** - same as paid version
- ⚠️ **Expires after 7 days** - need to reinstall
- ⚠️ **Only on your devices** - can't share with others

## 🔄 Method 2: AltStore (Advanced)

**Cost**: FREE  
**App Duration**: 7 days (auto-refreshes)  
**Setup Time**: 30 minutes  

### What is AltStore?
- Third-party app installer for iOS
- Uses your free Apple Developer account
- Automatically refreshes apps every 7 days
- No jailbreak required

### Steps:

1. **Install AltStore** on your computer:
   - Download from [altstore.io](https://altstore.io/)
   - Install AltServer on Windows/Mac

2. **Install AltStore on iPad**:
   - Connect iPad to computer
   - Follow AltStore installation guide
   - Trust the developer certificate

3. **Install DeepRecall**:
   - Download .ipa from GitHub Actions artifacts
   - Open AltStore on iPad
   - Import .ipa file
   - Install app

### Benefits:
- ✅ **Auto-refresh** - no manual reinstallation
- ✅ **Multiple apps** - install other sideloaded apps
- ✅ **Works offline** - once set up

## 📋 Method 3: Manual IPA Installation

**Cost**: FREE  
**Requirements**: Access to Mac + Xcode  

### Using Xcode Devices Window:

1. **Build unsigned IPA** (GitHub Actions creates this)
2. **Download IPA** from GitHub artifacts
3. **Open Xcode** on Mac
4. **Window → Devices and Simulators**
5. **Select your iPad**
6. **Drag IPA file** to the device
7. **App installs** immediately

### Using Apple Configurator 2:

1. **Download Apple Configurator 2** (free from App Store)
2. **Connect iPad**
3. **Double-click IPA file**
4. **Select your device**
5. **Install**

## 🛡️ Trust Settings

After installing via any method:

1. **Go to iPad Settings**
2. **General → VPN & Device Management**  
3. **Find your Apple ID** under "Developer App"
4. **Tap "Trust [Your Apple ID]"**
5. **Confirm trust**

## 💡 Which Method Should You Choose?

### For Quick Testing:
**Use Method 1** (Free Apple Developer + Xcode)
- Fastest setup
- Direct installation
- Perfect for development

### For Regular Use:
**Use Method 2** (AltStore)
- Auto-refresh every 7 days
- No manual reinstallation needed
- Better for daily use

### For Occasional Use:
**Use Method 3** (Manual IPA)
- No special software needed
- Just drag and drop
- Good for infrequent testing

## 🔄 Your Complete FREE Workflow:

1. **Develop on Windows/WSL2** (your current setup)
2. **Push to GitHub** (triggers automatic build)
3. **Download IPA** from GitHub Actions artifacts
4. **Install via your chosen method** above
5. **Test on iPad** with Apple Pencil
6. **Repeat** when app expires (7 days)

## 💰 When to Consider Paid Developer Account:

You might want the $99/year account if:
- ✅ You want **TestFlight** for easy sharing
- ✅ You plan to **publish to App Store**
- ✅ You want **1-year app duration** instead of 7 days
- ✅ You want to **share with beta testers**

## 🚨 Troubleshooting:

### "Untrusted Developer" Error:
- Go to Settings → General → VPN & Device Management
- Trust your Apple ID certificate

### "Unable to Install" Error:
- Check if you have a free developer account set up
- Ensure your device UDID is registered (automatic with free account)
- Try restarting iPad and reinstalling

### App Crashes on Launch:
- Check Xcode console for errors during installation
- Verify all required frameworks are included
- Test on iOS Simulator first

### 7-Day Expiry Management:
- Set calendar reminder to reinstall
- Use AltStore for automatic refresh
- Consider upgrading to paid account if this becomes annoying

The bottom line: **You can absolutely develop and test your iPad app for FREE!** The 7-day limitation is manageable during development, and you can always upgrade to paid later if needed. 🎉
