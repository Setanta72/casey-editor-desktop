import { useState } from 'react';
import { FolderOpen, Cloud, Check, AlertCircle } from 'lucide-react';

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

  const selectSitePath = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectDirectory();
      if (path) setSitePath(path);
    }
  };

  const selectMediaPath = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectDirectory();
      if (path) setMediaPath(path);
    }
  };

  const handleNext = () => {
    if (step === 1 && (!sitePath || !mediaPath)) {
      setError('Please select both directories');
      return;
    }
    if (step === 2 && (!cloudName || !apiKey || !apiSecret)) {
      setError('Please fill in all Cloudinary credentials');
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

      // Save credentials securely
      await window.electronAPI.setCloudinaryCredentials(apiKey, apiSecret);

      // Restart server with new config
      const success = await window.electronAPI.restartServer();

      if (success) {
        onComplete();
      } else {
        setError('Failed to start server. Please check your paths.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Casey Editor Setup</h1>
        <p className="text-gray-600 mb-6">Let's configure your content editor</p>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                s <= step ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            {error}
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
                The folder containing your Astro site (with src/content/)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sitePath}
                  readOnly
                  placeholder="Select website folder..."
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                />
                <button
                  onClick={selectSitePath}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
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
                Your image library folder (organized by category)
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mediaPath}
                  readOnly
                  placeholder="Select media folder..."
                  className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                />
                <button
                  onClick={selectMediaPath}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
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
              Your Cloudinary credentials for image hosting. Find these in your{' '}
              <a href="https://console.cloudinary.com/settings/api-keys" target="_blank" className="text-blue-500 hover:underline">
                Cloudinary Dashboard
              </a>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Cloud Name
              </label>
              <input
                type="text"
                value={cloudName}
                onChange={(e) => setCloudName(e.target.value)}
                placeholder="e.g., do7oi2ioy"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                API Key
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
              </label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Your API secret"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Check size={20} />
              Step 3: Confirm Setup
            </h2>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div>
                <span className="font-medium">Website:</span>{' '}
                <span className="text-gray-600">{sitePath}</span>
              </div>
              <div>
                <span className="font-medium">Media Library:</span>{' '}
                <span className="text-gray-600">{mediaPath}</span>
              </div>
              <div>
                <span className="font-medium">Cloudinary:</span>{' '}
                <span className="text-gray-600">{cloudName}</span>
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
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving...' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setup;
