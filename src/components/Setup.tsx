import { useState, useEffect } from 'react';
import { FolderOpen, Cloud, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface SetupProps {
  onComplete: () => void;
}

const Setup = ({ onComplete }: SetupProps) => {
  const [step, setStep] = useState(1);
  const [sitePath, setSitePath] = useState('');
  const [mediaPath, setMediaPath] = useState('');
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [sitePathValid, setSitePathValid] = useState<boolean | null>(null);
  const [mediaPathValid, setMediaPathValid] = useState<boolean | null>(null);
  const [migratedConfig, setMigratedConfig] = useState(false);

  // Check for migrated config on mount
  useEffect(() => {
    const checkExistingConfig = async () => {
      if (window.electronAPI) {
        const config = await window.electronAPI.getConfig();
        if (config.sitePath) {
          setSitePath(config.sitePath);
          setMigratedConfig(true);
        }
        if (config.mediaPath) {
          setMediaPath(config.mediaPath);
          setMigratedConfig(true);
        }
        if (config.cloudinaryCloudName) {
          setCloudName(config.cloudinaryCloudName);
          setMigratedConfig(true);
        }
      }
    };
    checkExistingConfig();
  }, []);

  const selectSitePath = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setSitePath(path);
        // Validate after selection
        validateSitePath(path);
      }
    }
  };

  const selectMediaPath = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setMediaPath(path);
        setMediaPathValid(true); // Media path just needs to exist
      }
    }
  };

  const validateSitePath = async (path: string) => {
    // Simple validation - check if it looks like an Astro site
    // The actual validation happens server-side
    setSitePathValid(path.length > 0);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!sitePath || !mediaPath) {
        setError('Please select both directories');
        return;
      }
    }
    if (step === 2 && !cloudName) {
      // API key and secret can come from .env, so only cloud name is required
      setError('Please enter your Cloudinary cloud name');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handleFinish = async () => {
    if (!window.electronAPI) return;

    setSaving(true);
    setError('');

    try {
      // Save paths
      await window.electronAPI.setConfig({
        sitePath,
        mediaPath,
        cloudinaryCloudName: cloudName
      });

      // Save credentials securely (if provided)
      if (apiKey && apiSecret) {
        await window.electronAPI.setCloudinaryCredentials(apiKey, apiSecret);
      }

      // Validate configuration
      const validation = await window.electronAPI.validateConfig();
      if (!validation.valid) {
        setError(validation.errors.join('\n'));
        setSaving(false);
        return;
      }

      // Restart server with new config
      const success = await window.electronAPI.restartServer();

      if (success) {
        onComplete();
      } else {
        const configPath = await window.electronAPI.getConfigPath();
        setError(`Failed to start server. Configuration saved to:\n${configPath}\n\nPlease check your paths and try again.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">ProofMark Setup</h1>
        <p className="text-gray-600 mb-6">Configure your markdown editor</p>

        {migratedConfig && step === 1 && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <RefreshCw size={18} />
            Found existing configuration. Please verify paths below.
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-wrap text-sm">{error}</span>
          </div>
        )}

        {/* Step 1: Paths */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Step 1: Content Locations</h2>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Website Directory
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Your Astro site folder (should contain <code className="bg-gray-100 px-1 rounded">src/content/</code>)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sitePath}
                  readOnly
                  placeholder="Select website folder..."
                  className={`flex-1 px-3 py-2 border rounded-lg bg-gray-50 ${
                    sitePathValid === false ? 'border-red-300' : sitePathValid === true ? 'border-green-300' : ''
                  }`}
                />
                <button
                  onClick={selectSitePath}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2"
                >
                  <FolderOpen size={18} />
                  Browse
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Media Library
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Your images and videos folder (e.g., <code className="bg-gray-100 px-1 rounded">~/Media</code>)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mediaPath}
                  readOnly
                  placeholder="Select media folder..."
                  className={`flex-1 px-3 py-2 border rounded-lg bg-gray-50 ${
                    mediaPathValid === true ? 'border-green-300' : ''
                  }`}
                />
                <button
                  onClick={selectMediaPath}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2"
                >
                  <FolderOpen size={18} />
                  Browse
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Cloudinary */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Cloud size={20} />
              Step 2: Cloudinary CDN
            </h2>
            <p className="text-sm text-gray-600">
              Your Cloudinary credentials for media hosting. Find these in your{' '}
              <a href="https://console.cloudinary.com/settings/api-keys" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">
                Cloudinary Dashboard
              </a>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Cloud Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="e.g., my-cloud-name"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                API Key
                <span className="text-gray-400 text-xs ml-2">(or set CLOUDINARY_API_KEY env var)</span>
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your API key"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                API Secret
                <span className="text-gray-400 text-xs ml-2">(or set CLOUDINARY_API_SECRET env var)</span>
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Your API secret"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <p className="text-xs text-gray-500">
              API credentials can also be set via environment variables or a .env file in the app directory.
            </p>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Check size={20} />
              Step 3: Confirm Setup
            </h2>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
              <div>
                <span className="font-medium text-gray-700">Website:</span>
                <p className="text-gray-600 font-mono text-xs mt-1 break-all">{sitePath}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Media Library:</span>
                <p className="text-gray-600 font-mono text-xs mt-1 break-all">{mediaPath}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Cloudinary:</span>
                <p className="text-gray-600 mt-1">{cloudName}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">API Credentials:</span>
                <p className="text-gray-600 mt-1">
                  {apiKey ? '✓ Provided' : '○ Will use environment variables'}
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              Click "Finish" to save your configuration and start the editor.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Starting...' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setup;
