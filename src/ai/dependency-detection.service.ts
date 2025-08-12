import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  DependencyStatus,
  SystemDependencies,
  PlatformInstallationInstructions,
  IDependencyDetectionService,
} from './interfaces/dependency.interface';

const execAsync = promisify(exec);

@Injectable()
export class DependencyDetectionService implements IDependencyDetectionService {
  private readonly logger = new Logger(DependencyDetectionService.name);
  private readonly platform: string;

  constructor(private readonly configService: ConfigService) {
    this.platform = process.platform;
    this.logger.log(`Initializing dependency detection for platform: ${this.platform}`);
  }

  /**
   * Check all system dependencies required for PDF-to-image conversion
   */
  async checkSystemDependencies(): Promise<SystemDependencies> {
    this.logger.log('Checking system dependencies for PDF-to-image conversion');

    const [graphicsMagick, imageMagick, pdf2pic] = await Promise.all([
      this.checkGraphicsMagick(),
      this.checkImageMagick(),
      this.checkPdf2pic(),
    ]);

    const dependencies: SystemDependencies = {
      graphicsMagick,
      imageMagick,
      pdf2pic,
    };

    this.logDependencyStatus(dependencies);
    return dependencies;
  }

  /**
   * Check GraphicsMagick availability
   */
  async checkGraphicsMagick(): Promise<DependencyStatus> {
    try {
      // Try custom path from config first
      const customPath = this.configService.get<string>('GRAPHICSMAGICK_PATH');
      const command = customPath || 'gm';

      const { stdout } = await execAsync(`${command} version`);
      
      // Extract version from output
      const versionMatch = stdout.match(/GraphicsMagick\s+([\d.]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      this.logger.log(`✅ GraphicsMagick found: version ${version}`);

      return {
        available: true,
        version,
        path: customPath || 'gm',
        installationInstructions: this.getGraphicsMagickInstructions(),
      };
    } catch (error) {
      this.logger.warn(`❌ GraphicsMagick not found: ${error.message}`);

      return {
        available: false,
        installationInstructions: this.getGraphicsMagickInstructions(),
      };
    }
  }

  /**
   * Check ImageMagick availability
   */
  async checkImageMagick(): Promise<DependencyStatus> {
    try {
      // Try custom path from config first
      const customPath = this.configService.get<string>('IMAGEMAGICK_PATH');
      const command = customPath || 'convert';

      const { stdout } = await execAsync(`${command} -version`);
      
      // Extract version from output
      const versionMatch = stdout.match(/ImageMagick\s+([\d.-]+)/i);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      this.logger.log(`✅ ImageMagick found: version ${version}`);

      return {
        available: true,
        version,
        path: customPath || 'convert',
        installationInstructions: this.getImageMagickInstructions(),
      };
    } catch (error) {
      this.logger.warn(`❌ ImageMagick not found: ${error.message}`);

      return {
        available: false,
        installationInstructions: this.getImageMagickInstructions(),
      };
    }
  }

  /**
   * Check pdf2pic npm package availability
   */
  async checkPdf2pic(): Promise<DependencyStatus> {
    try {
      // Try to import pdf2pic to check if it's available
      const pdf2pic = await import('pdf2pic');
      
      // Check if we can access the main function
      if (typeof pdf2pic.fromPath === 'function') {
        this.logger.log('✅ pdf2pic npm package found and functional');

        return {
          available: true,
          version: 'installed',
          installationInstructions: this.getPdf2picInstructions(),
        };
      } else {
        throw new Error('pdf2pic module loaded but fromPath function not available');
      }
    } catch (error) {
      this.logger.warn(`❌ pdf2pic not found or not functional: ${error.message}`);

      return {
        available: false,
        installationInstructions: this.getPdf2picInstructions(),
      };
    }
  }

  /**
   * Generate platform-specific installation instructions
   */
  generateInstallationInstructions(platform?: string): PlatformInstallationInstructions {
    const targetPlatform = platform || this.platform;

    return {
      windows: this.getWindowsInstructions(),
      macos: this.getMacOSInstructions(),
      linux: this.getLinuxInstructions(),
    };
  }

  /**
   * Check if PDF-to-image conversion is supported
   */
  async isConversionSupported(): Promise<boolean> {
    const dependencies = await this.checkSystemDependencies();
    
    // We need pdf2pic AND either GraphicsMagick or ImageMagick
    const hasImageProcessor = dependencies.graphicsMagick.available || dependencies.imageMagick.available;
    const hasPdf2pic = dependencies.pdf2pic.available;

    const isSupported = hasImageProcessor && hasPdf2pic;

    this.logger.log(`PDF-to-image conversion supported: ${isSupported}`);
    
    if (!isSupported) {
      this.logger.warn('Missing dependencies for PDF-to-image conversion:');
      if (!hasPdf2pic) {
        this.logger.warn('- pdf2pic npm package not available');
      }
      if (!hasImageProcessor) {
        this.logger.warn('- Neither GraphicsMagick nor ImageMagick available');
      }
    }

    return isSupported;
  }

  /**
   * Log dependency status in a readable format
   */
  private logDependencyStatus(dependencies: SystemDependencies): void {
    this.logger.log('=== System Dependencies Status ===');
    
    Object.entries(dependencies).forEach(([name, status]) => {
      const icon = status.available ? '✅' : '❌';
      const version = status.version ? ` (v${status.version})` : '';
      this.logger.log(`${icon} ${name}${version}: ${status.available ? 'Available' : 'Not Available'}`);
    });

    const conversionSupported = (dependencies.graphicsMagick.available || dependencies.imageMagick.available) && dependencies.pdf2pic.available;
    this.logger.log(`🔄 PDF-to-image conversion: ${conversionSupported ? 'Supported' : 'Not Supported'}`);
    this.logger.log('=====================================');
  }

  /**
   * Get GraphicsMagick installation instructions
   */
  private getGraphicsMagickInstructions(): string {
    const instructions = this.generateInstallationInstructions();
    
    switch (this.platform) {
      case 'win32':
        return `Windows: ${instructions.windows.find(i => i.includes('GraphicsMagick')) || 'Install GraphicsMagick from http://www.graphicsmagick.org/download.html'}`;
      case 'darwin':
        return `macOS: ${instructions.macos.find(i => i.includes('graphicsmagick')) || 'brew install graphicsmagick'}`;
      default:
        return `Linux: ${instructions.linux.find(i => i.includes('graphicsmagick')) || 'sudo apt-get install graphicsmagick'}`;
    }
  }

  /**
   * Get ImageMagick installation instructions
   */
  private getImageMagickInstructions(): string {
    const instructions = this.generateInstallationInstructions();
    
    switch (this.platform) {
      case 'win32':
        return `Windows: ${instructions.windows.find(i => i.includes('ImageMagick')) || 'Install ImageMagick from https://imagemagick.org/script/download.php#windows'}`;
      case 'darwin':
        return `macOS: ${instructions.macos.find(i => i.includes('imagemagick')) || 'brew install imagemagick'}`;
      default:
        return `Linux: ${instructions.linux.find(i => i.includes('imagemagick')) || 'sudo apt-get install imagemagick'}`;
    }
  }

  /**
   * Get pdf2pic installation instructions
   */
  private getPdf2picInstructions(): string {
    return 'npm install pdf2pic (should already be installed as a project dependency)';
  }

  /**
   * Get Windows-specific installation instructions
   */
  private getWindowsInstructions(): string[] {
    return [
      'choco install imagemagick (using Chocolatey)',
      'choco install graphicsmagick (using Chocolatey)',
      'Download ImageMagick from: https://imagemagick.org/script/download.php#windows',
      'Download GraphicsMagick from: http://www.graphicsmagick.org/download.html',
      'npm install pdf2pic (if not already installed)',
    ];
  }

  /**
   * Get macOS-specific installation instructions
   */
  private getMacOSInstructions(): string[] {
    return [
      'brew install imagemagick',
      'brew install graphicsmagick',
      'port install ImageMagick (using MacPorts)',
      'port install GraphicsMagick (using MacPorts)',
      'npm install pdf2pic (if not already installed)',
    ];
  }

  /**
   * Get Linux-specific installation instructions
   */
  private getLinuxInstructions(): string[] {
    return [
      'sudo apt-get update && sudo apt-get install imagemagick (Ubuntu/Debian)',
      'sudo apt-get install graphicsmagick (Ubuntu/Debian)',
      'sudo yum install ImageMagick (CentOS/RHEL)',
      'sudo yum install GraphicsMagick (CentOS/RHEL)',
      'sudo pacman -S imagemagick (Arch Linux)',
      'sudo pacman -S graphicsmagick (Arch Linux)',
      'npm install pdf2pic (if not already installed)',
    ];
  }
}