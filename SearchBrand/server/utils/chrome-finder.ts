import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export function findChromePath(logPrefix: string = '[Chrome]'): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      console.log(`${logPrefix} Using env PUPPETEER_EXECUTABLE_PATH:`, process.env.PUPPETEER_EXECUTABLE_PATH);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    console.warn(`${logPrefix} PUPPETEER_EXECUTABLE_PATH set but file not found:`, process.env.PUPPETEER_EXECUTABLE_PATH);
  }
  
  try {
    const systemPath = execSync('which chromium', { encoding: 'utf8' }).trim();
    if (systemPath && existsSync(systemPath)) {
      console.log(`${logPrefix} Using system Chromium:`, systemPath);
      return systemPath;
    }
  } catch {
  }

  // Nix store에서 chromium 검색 (프로덕션 환경용)
  try {
    const nixChromium = execSync('find /nix/store -maxdepth 2 -name chromium -type f 2>/dev/null | head -1', { encoding: 'utf8', timeout: 5000 }).trim();
    if (nixChromium && existsSync(nixChromium)) {
      console.log(`${logPrefix} Using Nix store Chromium:`, nixChromium);
      return nixChromium;
    }
  } catch {
  }
  
  // Nix store chromium 패키지 bin 경로 검색
  try {
    const nixBinPath = execSync('find /nix/store -path "*/chromium-*/bin/chromium" 2>/dev/null | head -1', { encoding: 'utf8', timeout: 10000 }).trim();
    if (nixBinPath && existsSync(nixBinPath)) {
      console.log(`${logPrefix} Using Nix store Chromium bin:`, nixBinPath);
      return nixBinPath;
    }
  } catch {
  }

  try {
    const systemChrome = execSync('which google-chrome', { encoding: 'utf8' }).trim();
    if (systemChrome && existsSync(systemChrome)) {
      console.log(`${logPrefix} Using system Google Chrome:`, systemChrome);
      return systemChrome;
    }
  } catch {
  }

  const puppeteerCachePath = findPuppeteerCacheChrome(logPrefix);
  if (puppeteerCachePath) {
    return puppeteerCachePath;
  }

  const commonPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  
  for (const chromePath of commonPaths) {
    if (existsSync(chromePath)) {
      console.log(`${logPrefix} Using Chrome at:`, chromePath);
      return chromePath;
    }
  }

  console.warn(`${logPrefix} No valid Chrome/Chromium found.`);
  console.warn(`${logPrefix} Run "npx puppeteer browsers install chrome" to install Chrome.`);
  return undefined;
}

function findPuppeteerCacheChrome(logPrefix: string): string | undefined {
  const cacheBase = join(homedir(), '.cache', 'puppeteer');
  
  if (!existsSync(cacheBase)) {
    return undefined;
  }

  try {
    const chromeDirs = readdirSync(cacheBase).filter(dir => dir.startsWith('chrome'));
    
    for (const chromeDir of chromeDirs) {
      const chromePath = join(cacheBase, chromeDir);
      
      if (!existsSync(chromePath)) continue;
      
      const versions = readdirSync(chromePath);
      
      for (const version of versions.sort().reverse()) {
        const possiblePaths = [
          join(chromePath, version, 'chrome-linux64', 'chrome'),
          join(chromePath, version, 'chrome-linux', 'chrome'),
          join(chromePath, version, 'chrome'),
          join(chromePath, version, 'Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
        ];
        
        for (const execPath of possiblePaths) {
          if (existsSync(execPath)) {
            console.log(`${logPrefix} Using Puppeteer cache Chrome:`, execPath);
            return execPath;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`${logPrefix} Error scanning Puppeteer cache:`, err);
  }

  return undefined;
}
