# Windows to iOS Development Guide

Complete workflow for developing DeepRecall iOS app on Windows/WSL2 using cloud services.

## 🎯 Quick Answer to Your Questions

**Q: Does initialization need a Mac?**  
**A: No!** You can do 90% of setup on Windows/WSL2, including:
- Installing Capacitor packages
- Creating iOS project files  
- Building Next.js assets
- Generating the complete project structure

**Q: Does the build script only work on Mac?**  
**A: The final Xcode build requires macOS**, but you can:
- Use cloud Mac services (recommended)
- Set up GitHub Actions for automated builds
- Build everything except the final .ipa on Windows

## 🛠️ Complete Windows Workflow

### Step 1: Windows/WSL2 Setup (Do this now!)

```bash
# In your WSL2 terminal
cd /home/renlephy/DeepRecall/frontend

# Run the Windows-friendly initialization
./init-capacitor-windows.sh
```

This creates:
- `ios/` folder with complete Xcode project
- `out/` folder with built web assets  
- `capacitor.config.ts` configuration
- All necessary project files

### Step 2: Choose Your macOS Strategy

#### Option A: GitHub Actions (Recommended - Free!)

1. **Push to GitHub** (your code is already there)
2. **GitHub automatically builds** using our workflow
3. **Download .ipa** from GitHub artifacts
4. **Install via iTunes/Finder** or **TestFlight**

#### Option B: Cloud Mac Service

**Best for**: Regular development, real-time testing

**Services comparison:**
- **MacStadium**: $79-199/month, dedicated Mac
- **AWS EC2 Mac**: $25/day minimum, pay-per-use  
- **MacInCloud**: $30-50/month, shared Mac
- **GitHub Codespaces**: $0.18/hour, integrated with GitHub

#### Option C: Borrow/Buy a Mac

**Best for**: If you plan serious iOS development

### Step 3: Testing on iPad

**Good News**: You don't need the $99/year Apple Developer account!

#### Method 1: FREE Apple Developer Account (Recommended)
1. **Build app** on cloud Mac with your free Apple ID
2. **Install directly** via Xcode (expires in 7 days)
3. **Reinstall** when it expires (automated via GitHub Actions)

#### Method 2: AltStore (Advanced)
1. **Set up AltStore** on your iPad (one-time setup)
2. **Download .ipa** from GitHub Actions
3. **Auto-refresh** every 7 days (no manual reinstall)

#### Method 3: TestFlight (Paid - $99/year)
1. **Upload to TestFlight** (requires paid Apple Developer account)
2. **Install on iPad** over-the-air
3. **Share with others** easily

**See `FREE_INSTALLATION_GUIDE.md` for detailed instructions on free methods.**

## 🌥️ Detailed Cloud Mac Setup

### Using AWS EC2 Mac (Pay-per-use example)

```bash
# 1. Launch EC2 Mac instance (AWS Console)
# 2. SSH into the instance
ssh -i your-key.pem ec2-user@your-mac-instance.compute.amazonaws.com

# 3. Install development tools
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node pnpm git

# 4. Clone your repo
git clone https://github.com/RnLe/DeepRecall.git
cd DeepRecall/frontend

# 5. Complete the build
pnpm install
npx cap sync ios
npx cap open ios  # Opens Xcode
```

### Using GitHub Codespaces

```bash
# 1. Go to your GitHub repo
# 2. Click "Code" > "Codespaces" > "Create codespace on main"
# 3. Wait for macOS environment to load
# 4. Run build commands

cd frontend
pnpm install
./build-ios.sh
```

## 📱 Complete Deployment Workflow

### 1. Development Loop (Windows)
```bash
# Make your changes in WSL2
code /home/renlephy/DeepRecall/frontend

# Test in browser
cd frontend && pnpm dev

# When ready, rebuild assets
./init-capacitor-windows.sh
```

### 2. iOS Build (Cloud/GitHub Actions)
```bash
# Push changes
git add . && git commit -m "Update for iOS" && git push

# GitHub Actions automatically:
# - Builds Next.js app
# - Syncs with Capacitor  
# - Builds iOS app
# - Creates .ipa file
```

### 3. iPad Testing (Over-the-air)
- Download .ipa from GitHub artifacts
- Install via TestFlight or iTunes
- Test on real device with Apple Pencil

## 💰 Cost Comparison

| Method | Setup Cost | Monthly Cost | Pros | Cons |
|--------|------------|--------------|------|------|
| **GitHub Actions** | $0 | $0* | Free, automated | 2000 min/month limit |
| **MacStadium** | $0 | $79-199 | Dedicated, fast | Expensive |
| **AWS EC2 Mac** | $0 | ~$25/day when used | Pay-per-use | Minimum 24h billing |
| **MacInCloud** | $0 | $30-50 | Budget-friendly | Shared resources |
| **Buy Mac Mini** | $599+ | $0 | Own hardware | High upfront cost |

*GitHub Actions: 2000 minutes/month free, then $0.008/minute

## 🚀 Recommended Path for You

Given your situation, I recommend:

1. **Start with GitHub Actions** (free, automated)
2. **Set up TestFlight** for iPad testing ($99/year Apple Developer)
3. **Consider MacStadium** if you need frequent builds

### Immediate Next Steps:

1. **Run the Windows setup** (you can do this now):
   ```bash
   cd /home/renlephy/DeepRecall/frontend
   ./init-capacitor-windows.sh
   ```

2. **Push to GitHub** to trigger the build workflow

3. **Sign up for Apple Developer** to enable TestFlight

4. **Test the complete pipeline** with a simple change

This approach lets you:
- ✅ Develop entirely on Windows/WSL2
- ✅ Build automatically on every commit  
- ✅ Test on real iPad with Apple Pencil
- ✅ Keep costs minimal initially
- ✅ Scale up to dedicated Mac later if needed

## 🔧 Troubleshooting Cloud Services

### Common Issues:
- **Build timeouts**: Increase GitHub Actions timeout
- **Certificate issues**: Use development certificates initially
- **Network issues**: Ensure cloud Mac can access your repo
- **Xcode version**: Use latest Xcode version for compatibility

### Debug Tips:
- **Check GitHub Actions logs** for build failures
- **Use Xcode Simulator** on cloud Mac for initial testing
- **Test web version first** to isolate iOS-specific issues
- **Keep builds simple** initially, add complexity gradually
