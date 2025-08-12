import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DependencyDetectionService } from './dependency-detection.service';
import { DependencyStatus, SystemDependencies } from './interfaces/dependency.interface';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock child_process
jest.mock('child_process');
jest.mock('util');

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockPromisify = promisify as jest.MockedFunction<typeof promisify>;

describe('DependencyDetectionService', () => {
  let service: DependencyDetectionService;
  let configService: ConfigService;
  let mockExecAsync: jest.MockedFunction<any>;

  beforeEach(async () => {
    // Setup mock execAsync
    mockExecAsync = jest.fn();
    mockPromisify.mockReturnValue(mockExecAsync);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependencyDetectionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DependencyDetectionService>(DependencyDetectionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkGraphicsMagick', () => {
    it('should detect GraphicsMagick when available', async () => {
      const mockStdout = 'GraphicsMagick 1.3.38 2022-03-26 Q16 http://www.GraphicsMagick.org/';
      mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const result = await service.checkGraphicsMagick();

      expect(result.available).toBe(true);
      expect(result.version).toBe('1.3.38');
      expect(result.path).toBe('gm');
      expect(result.installationInstructions).toContain('GraphicsMagick');
      expect(mockExecAsync).toHaveBeenCalledWith('gm version');
    });

    it('should use custom path from config when provided', async () => {
      const customPath = '/usr/local/bin/gm';
      const mockStdout = 'GraphicsMagick 1.3.38 2022-03-26 Q16 http://www.GraphicsMagick.org/';
      
      (configService.get as jest.Mock).mockReturnValue(customPath);
      mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const result = await service.checkGraphicsMagick();

      expect(result.available).toBe(true);
      expect(result.path).toBe(customPath);
      expect(mockExecAsync).toHaveBeenCalledWith(`${customPath} version`);
    });

    it('should handle GraphicsMagick not found', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      const result = await service.checkGraphicsMagick();

      expect(result.available).toBe(false);
      expect(result.version).toBeUndefined();
      expect(result.path).toBeUndefined();
      expect(result.installationInstructions).toContain('GraphicsMagick');
    });

    it('should handle version parsing failure gracefully', async () => {
      const mockStdout = 'Some unexpected output without version';
      mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const result = await service.checkGraphicsMagick();

      expect(result.available).toBe(true);
      expect(result.version).toBe('unknown');
    });
  });

  describe('checkImageMagick', () => {
    it('should detect ImageMagick when available', async () => {
      const mockStdout = 'Version: ImageMagick 7.1.0-62 Q16-HDRI x86_64 2023-01-29';
      mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const result = await service.checkImageMagick();

      expect(result.available).toBe(true);
      expect(result.version).toBe('7.1.0-62');
      expect(result.path).toBe('convert');
      expect(result.installationInstructions).toContain('ImageMagick');
      expect(mockExecAsync).toHaveBeenCalledWith('convert -version');
    });

    it('should use custom path from config when provided', async () => {
      const customPath = '/usr/local/bin/convert';
      const mockStdout = 'Version: ImageMagick 7.1.0-62 Q16-HDRI x86_64 2023-01-29';
      
      (configService.get as jest.Mock).mockReturnValue(customPath);
      mockExecAsync.mockResolvedValue({ stdout: mockStdout, stderr: '' });

      const result = await service.checkImageMagick();

      expect(result.available).toBe(true);
      expect(result.path).toBe(customPath);
      expect(mockExecAsync).toHaveBeenCalledWith(`${customPath} -version`);
    });

    it('should handle ImageMagick not found', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      const result = await service.checkImageMagick();

      expect(result.available).toBe(false);
      expect(result.version).toBeUndefined();
      expect(result.path).toBeUndefined();
      expect(result.installationInstructions).toContain('ImageMagick');
    });
  });

  describe('checkPdf2pic', () => {
    it('should detect pdf2pic when available and functional', async () => {
      // Mock successful import with fromPath function
      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn(),
      }), { virtual: true });

      const result = await service.checkPdf2pic();

      expect(result.available).toBe(true);
      expect(result.version).toBe('installed');
      expect(result.installationInstructions).toContain('npm install pdf2pic');
    });

    it('should handle pdf2pic not available', async () => {
      // Mock import failure
      jest.doMock('pdf2pic', () => {
        throw new Error('Module not found');
      }, { virtual: true });

      const result = await service.checkPdf2pic();

      expect(result.available).toBe(false);
      expect(result.version).toBeUndefined();
      expect(result.installationInstructions).toContain('npm install pdf2pic');
    });

    it('should handle pdf2pic module loaded but not functional', async () => {
      // Mock import success but missing fromPath function
      jest.doMock('pdf2pic', () => ({}), { virtual: true });

      const result = await service.checkPdf2pic();

      expect(result.available).toBe(false);
      expect(result.installationInstructions).toContain('npm install pdf2pic');
    });
  });

  describe('checkSystemDependencies', () => {
    it('should check all dependencies and return comprehensive status', async () => {
      // Mock GraphicsMagick available
      mockExecAsync.mockImplementation((command: string) => {
        if (command.includes('gm version')) {
          return Promise.resolve({ 
            stdout: 'GraphicsMagick 1.3.38 2022-03-26 Q16', 
            stderr: '' 
          });
        }
        if (command.includes('convert -version')) {
          return Promise.reject(new Error('Command not found'));
        }
        return Promise.reject(new Error('Unknown command'));
      });

      // Mock pdf2pic available
      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn(),
      }), { virtual: true });

      const result = await service.checkSystemDependencies();

      expect(result).toHaveProperty('graphicsMagick');
      expect(result).toHaveProperty('imageMagick');
      expect(result).toHaveProperty('pdf2pic');
      expect(result.graphicsMagick.available).toBe(true);
      expect(result.imageMagick.available).toBe(false);
    });
  });

  describe('isConversionSupported', () => {
    it('should return true when both image processor and pdf2pic are available', async () => {
      // Mock GraphicsMagick available
      mockExecAsync.mockImplementation((command: string) => {
        if (command.includes('gm version')) {
          return Promise.resolve({ 
            stdout: 'GraphicsMagick 1.3.38 2022-03-26 Q16', 
            stderr: '' 
          });
        }
        return Promise.reject(new Error('Command not found'));
      });

      // Mock pdf2pic available
      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn(),
      }), { virtual: true });

      const result = await service.isConversionSupported();

      expect(result).toBe(true);
    });

    it('should return false when image processor is missing', async () => {
      // Mock both GraphicsMagick and ImageMagick unavailable
      mockExecAsync.mockRejectedValue(new Error('Command not found'));

      // Mock pdf2pic available
      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn(),
      }), { virtual: true });

      const result = await service.isConversionSupported();

      expect(result).toBe(false);
    });

    it('should return false when pdf2pic is missing', async () => {
      // Mock GraphicsMagick available
      mockExecAsync.mockImplementation((command: string) => {
        if (command.includes('gm version')) {
          return Promise.resolve({ 
            stdout: 'GraphicsMagick 1.3.38 2022-03-26 Q16', 
            stderr: '' 
          });
        }
        return Promise.reject(new Error('Command not found'));
      });

      // Mock pdf2pic unavailable
      jest.doMock('pdf2pic', () => {
        throw new Error('Module not found');
      }, { virtual: true });

      const result = await service.isConversionSupported();

      expect(result).toBe(false);
    });

    it('should return true when ImageMagick is available (even if GraphicsMagick is not)', async () => {
      // Mock ImageMagick available, GraphicsMagick not
      mockExecAsync.mockImplementation((command: string) => {
        if (command.includes('convert -version')) {
          return Promise.resolve({ 
            stdout: 'Version: ImageMagick 7.1.0-62 Q16-HDRI', 
            stderr: '' 
          });
        }
        return Promise.reject(new Error('Command not found'));
      });

      // Mock pdf2pic available
      jest.doMock('pdf2pic', () => ({
        fromPath: jest.fn(),
      }), { virtual: true });

      const result = await service.isConversionSupported();

      expect(result).toBe(true);
    });
  });

  describe('generateInstallationInstructions', () => {
    it('should return platform-specific instructions', () => {
      const instructions = service.generateInstallationInstructions();

      expect(instructions).toHaveProperty('windows');
      expect(instructions).toHaveProperty('macos');
      expect(instructions).toHaveProperty('linux');
      
      expect(Array.isArray(instructions.windows)).toBe(true);
      expect(Array.isArray(instructions.macos)).toBe(true);
      expect(Array.isArray(instructions.linux)).toBe(true);
      
      expect(instructions.windows.length).toBeGreaterThan(0);
      expect(instructions.macos.length).toBeGreaterThan(0);
      expect(instructions.linux.length).toBeGreaterThan(0);
    });

    it('should include ImageMagick instructions for all platforms', () => {
      const instructions = service.generateInstallationInstructions();

      expect(instructions.windows.some(i => i.toLowerCase().includes('imagemagick'))).toBe(true);
      expect(instructions.macos.some(i => i.toLowerCase().includes('imagemagick'))).toBe(true);
      expect(instructions.linux.some(i => i.toLowerCase().includes('imagemagick'))).toBe(true);
    });

    it('should include GraphicsMagick instructions for all platforms', () => {
      const instructions = service.generateInstallationInstructions();

      expect(instructions.windows.some(i => i.toLowerCase().includes('graphicsmagick'))).toBe(true);
      expect(instructions.macos.some(i => i.toLowerCase().includes('graphicsmagick'))).toBe(true);
      expect(instructions.linux.some(i => i.toLowerCase().includes('graphicsmagick'))).toBe(true);
    });

    it('should include npm install instructions for all platforms', () => {
      const instructions = service.generateInstallationInstructions();

      expect(instructions.windows.some(i => i.includes('npm install pdf2pic'))).toBe(true);
      expect(instructions.macos.some(i => i.includes('npm install pdf2pic'))).toBe(true);
      expect(instructions.linux.some(i => i.includes('npm install pdf2pic'))).toBe(true);
    });
  });

  describe('platform-specific behavior', () => {
    let originalPlatform: string;

    beforeEach(() => {
      originalPlatform = process.platform;
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
      });
    });

    it('should provide Windows-specific instructions on Windows', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
      });

      // Create new service instance to pick up platform change
      const windowsService = new DependencyDetectionService(configService);
      const instructions = windowsService.generateInstallationInstructions();

      expect(instructions.windows.some(i => i.includes('choco install'))).toBe(true);
      expect(instructions.windows.some(i => i.includes('https://imagemagick.org'))).toBe(true);
    });

    it('should provide macOS-specific instructions on macOS', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
      });

      const macService = new DependencyDetectionService(configService);
      const instructions = macService.generateInstallationInstructions();

      expect(instructions.macos.some(i => i.includes('brew install'))).toBe(true);
      expect(instructions.macos.some(i => i.includes('port install'))).toBe(true);
    });

    it('should provide Linux-specific instructions on Linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
      });

      const linuxService = new DependencyDetectionService(configService);
      const instructions = linuxService.generateInstallationInstructions();

      expect(instructions.linux.some(i => i.includes('apt-get install'))).toBe(true);
      expect(instructions.linux.some(i => i.includes('yum install'))).toBe(true);
      expect(instructions.linux.some(i => i.includes('pacman -S'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle exec timeout gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Command timed out'));

      const result = await service.checkGraphicsMagick();

      expect(result.available).toBe(false);
      expect(result.installationInstructions).toBeDefined();
    });

    it('should handle permission errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Permission denied'));

      const result = await service.checkImageMagick();

      expect(result.available).toBe(false);
      expect(result.installationInstructions).toBeDefined();
    });

    it('should handle malformed version output gracefully', async () => {
      mockExecAsync.mockResolvedValue({ stdout: 'Invalid output', stderr: '' });

      const result = await service.checkGraphicsMagick();

      expect(result.available).toBe(true);
      expect(result.version).toBe('unknown');
    });
  });

  describe('configuration integration', () => {
    it('should respect GRAPHICSMAGICK_PATH environment variable', async () => {
      const customPath = '/custom/path/to/gm';
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'GRAPHICSMAGICK_PATH') return customPath;
        return undefined;
      });

      mockExecAsync.mockResolvedValue({ 
        stdout: 'GraphicsMagick 1.3.38 2022-03-26 Q16', 
        stderr: '' 
      });

      await service.checkGraphicsMagick();

      expect(mockExecAsync).toHaveBeenCalledWith(`${customPath} version`);
    });

    it('should respect IMAGEMAGICK_PATH environment variable', async () => {
      const customPath = '/custom/path/to/convert';
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'IMAGEMAGICK_PATH') return customPath;
        return undefined;
      });

      mockExecAsync.mockResolvedValue({ 
        stdout: 'Version: ImageMagick 7.1.0-62 Q16-HDRI', 
        stderr: '' 
      });

      await service.checkImageMagick();

      expect(mockExecAsync).toHaveBeenCalledWith(`${customPath} -version`);
    });
  });
});