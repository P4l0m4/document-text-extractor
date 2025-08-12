export interface DependencyStatus {
  available: boolean;
  version?: string;
  path?: string;
  installationInstructions: string;
}

export interface SystemDependencies {
  graphicsMagick: DependencyStatus;
  imageMagick: DependencyStatus;
  pdf2pic: DependencyStatus;
}

export interface PlatformInstallationInstructions {
  windows: string[];
  macos: string[];
  linux: string[];
}

export interface IDependencyDetectionService {
  checkSystemDependencies(): Promise<SystemDependencies>;
  checkGraphicsMagick(): Promise<DependencyStatus>;
  checkImageMagick(): Promise<DependencyStatus>;
  checkPdf2pic(): Promise<DependencyStatus>;
  generateInstallationInstructions(platform: string): PlatformInstallationInstructions;
  isConversionSupported(): Promise<boolean>;
}