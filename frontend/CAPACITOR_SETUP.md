# DeepRecall iOS App Setup with Capacitor

This guide walks you through setting up DeepRecall as a native iOS app using Capacitor.

## 🎯 Overview

DeepRecall now supports native iOS deployment with the following features:
- ✅ Native iOS app with full Next.js/React functionality
- ✅ Apple Pencil support for enhanced annotation experience
- ✅ Haptic feedback for interactive elements
- ✅ Offline annotation storage
- ✅ Native file system access
- ✅ App lifecycle management

## 📋 Prerequisites

### For Development (Windows/WSL2/Linux/macOS)
- **Node.js** 18+ 
- **pnpm** package manager
- **Git** for version control

### For iOS Builds (macOS Only)
- **macOS** (required for final iOS builds)
- **Xcode** (latest version from App Store)
- **Apple Developer Account** (for device testing and App Store)

### Hardware Requirements
- **Development**: Any computer (Windows, Linux, macOS)
- **iOS Building**: Mac (MacBook, iMac, Mac Studio, etc.) OR cloud Mac service
- **Testing**: iPad (preferably with Apple Pencil support)
- **Connection**: USB-C to USB-C cable or Lightning to USB cable (depending on your iPad)

## 🚀 Quick Start

### Phase 1: Setup on Windows/WSL2 (You can do this now!)

From the `frontend/` directory in WSL2:

```bash
cd frontend
pnpm install

# Initialize Capacitor (works on Windows/WSL2)
npx cap init

# Add iOS platform (generates project files - works on Windows)
npx cap add ios

# Build the web assets (works on Windows/WSL2) 
pnpm run build
```

### Phase 2: iOS Build (Requires macOS or Cloud Service)

**Option A: Cloud Mac Service (Recommended for Windows users)**
**Option B: Physical Mac**
**Option C: CI/CD Pipeline**

## 🌥️ Cloud Mac Services for Windows Users

Since you're on Windows/WSL2, here are the best cloud options:

### 1. **MacStadium** (Recommended)
- **What it is**: Dedicated Mac cloud hosting
- **Cost**: ~$79-199/month for Mac mini
- **iPad Connection**: ❌ No direct USB connection
- **Best for**: Professional development, CI/CD

### 2. **AWS EC2 Mac Instances**
- **What it is**: Amazon's Mac cloud instances
- **Cost**: ~$1.08/hour (minimum 24h commitment)
- **iPad Connection**: ❌ No direct USB connection  
- **Best for**: Occasional builds, testing

### 3. **GitHub Codespaces + Actions**
- **What it is**: GitHub's cloud development environment
- **Cost**: Free tier available, then ~$0.18/hour
- **iPad Connection**: ❌ No direct USB connection
- **Best for**: Open source projects, CI/CD

### 4. **MacInCloud**
- **What it is**: Shared Mac cloud hosting
- **Cost**: ~$30-50/month
- **iPad Connection**: ❌ No direct USB connection
- **Best for**: Budget option, occasional use

### 🎯 **Reality Check: iPad Connection**

**Important**: Cloud Mac services **cannot** directly connect to your iPad via USB. Here's what this means:

#### ✅ **What You CAN Do with Cloud Mac:**
- Build the iOS app
- Test in iOS Simulator
- Create .ipa files for distribution
- Upload to TestFlight for over-the-air installation
- Submit to App Store

#### ❌ **What You CANNOT Do:**
- Direct USB debugging to your iPad
- Live debugging during development
- Install directly via Xcode to connected device

### 🔄 **Recommended Workflow for Windows + Cloud Mac:**

1. **Develop on Windows/WSL2** (90% of work)
2. **Test in browser** with iPad simulator tools
3. **Build on Cloud Mac** when ready
4. **Deploy via TestFlight** to your iPad
5. **Iterate** based on real device testing

## 📱 Features

### Apple Pencil Integration

The app automatically detects Apple Pencil input and provides:
- **Haptic feedback** when creating annotations
- **Optimized touch handling** for precise drawing
- **Pressure sensitivity** support (where available)

### Offline Support

- **Annotations saved locally** using Capacitor Filesystem API
- **Preferences stored natively** using Capacitor Preferences API
- **Automatic sync** when connection is restored

### Native iOS Features

- **Safe area handling** for devices with notches/home indicators
- **Status bar integration**
- **App lifecycle management** (background/foreground handling)
- **Native file sharing** capabilities

## 🛠️ Development Workflow

### Daily Development

1. **Make changes** to your React/Next.js code
2. **Test in browser** first: `pnpm dev`
3. **Build for iOS**: `./build-ios.sh`
4. **Test on device** via Xcode

### Code Organization

```
frontend/
├── app/
│   ├── customHooks/
│   │   └── useCapacitorAnnotations.ts    # Capacitor integration hook
│   ├── utils/
│   │   └── capacitorUtils.ts             # Capacitor utility functions
│   └── ui/
│       └── layout/
│           └── MobileLayout.tsx          # Mobile-optimized layout
├── capacitor.config.ts                   # Capacitor configuration
├── build-ios.sh                         # Build script
└── ios/                                  # Generated iOS project
```

### Key Files

- **`capacitor.config.ts`**: Capacitor configuration and plugin settings
- **`useCapacitorAnnotations.ts`**: React hook for annotation features
- **`capacitorUtils.ts`**: Utility functions for native features
- **`MobileLayout.tsx`**: Mobile-optimized UI layout

## 🔧 Configuration

### Capacitor Configuration

The `capacitor.config.ts` file contains:

```typescript
{
  appId: 'com.deeprecall.app',
  appName: 'DeepRecall',
  webDir: 'out',
  plugins: {
    Haptics: { enabled: true },
    Filesystem: { enabled: true },
    Preferences: { enabled: true },
    App: { enabled: true }
  }
}
```

### Next.js Configuration

The app uses static export for Capacitor:

```typescript
{
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true
}
```

## 📝 Usage Examples

### Using Capacitor Features in Components

```typescript
import { useCapacitorAnnotations } from '@/app/customHooks/useCapacitorAnnotations';

const MyComponent = () => {
  const { 
    isNative, 
    supportsPen, 
    saveAnnotationWithOfflineSupport 
  } = useCapacitorAnnotations();

  const handleSave = async (annotation) => {
    await saveAnnotationWithOfflineSupport(annotation.id, annotation);
  };

  return (
    <div>
      {isNative && <p>Running on native iOS!</p>}
      {supportsPen && <p>Apple Pencil detected!</p>}
    </div>
  );
};
```

### Haptic Feedback

```typescript
import CapacitorUtils from '@/app/utils/capacitorUtils';

// Light feedback for UI interactions
await CapacitorUtils.hapticFeedback('light');

// Medium feedback for important actions
await CapacitorUtils.hapticFeedback('medium');

// Heavy feedback for critical actions
await CapacitorUtils.hapticFeedback('heavy');
```

## 🚨 Troubleshooting

### Common Issues

**Build fails with "Module not found"**
- Run `pnpm install` in the frontend directory
- Check that all Capacitor packages are installed

**Xcode won't open**
- Ensure Xcode Command Line Tools are installed: `xcode-select --install`
- Try running `npx cap open ios` manually

**App crashes on launch**
- Check the Xcode console for error messages
- Ensure all required permissions are set in iOS project

**Touch events not working**
- Verify `touchAction: 'none'` is set for annotation areas
- Check that touch event handlers are properly bound

### iOS Device Setup

1. **Enable Developer Mode**:
   - Settings → Privacy & Security → Developer Mode → On
   
2. **Trust Developer**:
   - When running app first time, go to Settings → General → VPN & Device Management
   - Trust your developer certificate

3. **USB Connection**:
   - Use a data cable (not charging-only)
   - Ensure "Trust This Computer" is selected on iPad

### Performance Optimization

- **Large PDFs**: Consider implementing page virtualization
- **Memory Usage**: Clear canvas when pages are not visible
- **Touch Responsiveness**: Use `touch-action: manipulation` for better response

## 🔄 CI/CD Setup (Optional)

For automated builds, consider:

- **GitHub Actions** with macOS runners
- **Expo EAS Build** for cloud builds
- **Bitrise** or **CodeMagic** for mobile-specific CI/CD

Example GitHub Action:

```yaml
name: iOS Build
on: [push]
jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g pnpm
      - run: cd frontend && pnpm install
      - run: cd frontend && ./build-ios.sh
```

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [iOS App Distribution Guide](https://developer.apple.com/documentation/xcode/distributing-your-app)
- [Apple Pencil Best Practices](https://developer.apple.com/documentation/pencilkit)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)

## 🤝 Support

If you encounter issues:

1. Check this documentation first
2. Look at Capacitor's official documentation
3. Check iOS-specific requirements in Apple's developer docs
4. Test the web version first to isolate Capacitor-specific issues
