import { useState, useEffect } from 'react';
import { FolderOpen, Cloud, Save, CheckCircle, AlertCircle, RefreshCw, Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  const [sitePath, setSitePath] = useState('');
  const [mediaPath, setMediaPath] = useState('');
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [configPath, setConfigPath] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);

  // Load current config on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (window.electronAPI) {
        const config = await window.electronAPI.getConfig();
        setSitePath(config.sitePath || '');
        setMediaPath(config.mediaPath || '');
        setCloudName(config.cloudinaryCloudName || '');

        const path = await window.electronAPI.getConfigPath();
        setConfigPath(path);

        const valid = await window.electronAPI.validateConfig();
        setValidation(valid);
      }
    };
    loadConfig();
  }, []);

  const selectSitePath = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setSitePath(path);
        setHasChanges(true);
      }
    }
  };

  const selectMediaPath = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        setMediaPath(path);
        setHasChanges(true);
      }
    }
  };

  const handleSave = async () => {
    if (!window.electronAPI) return;

    setSaving(true);
    setMessage(null);

    try {
      // Save paths and cloud name
      await window.electronAPI.setConfig({
        sitePath,
        mediaPath,
        cloudinaryCloudName: cloudName
      });

      // Save credentials if provided (non-empty)
      if (apiKey && apiSecret) {
        await window.electronAPI.setCloudinaryCredentials(apiKey, apiSecret);
      }

      // Validate
      const valid = await window.electronAPI.validateConfig();
      setValidation(valid);

      if (!valid.valid) {
        setMessage({ type: 'error', text: valid.errors.join('\n') });
        setSaving(false);
        return;
      }

      // Restart server to apply changes
      const success = await window.electronAPI.restartServer();

      if (success) {
        setMessage({ type: 'success', text: 'Settings saved and server restarted' });
        setHasChanges(false);
        // Clear credential fields after save (they're stored securely)
        setApiKey('');
        setApiSecret('');
      } else {
        setMessage({ type: 'error', text: 'Settings saved but server failed to restart. Try restarting the app.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (setter: (val: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <SettingsIcon size={24} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
            <p className="text-gray-500 text-sm">Configure ProofMark</p>
          </div>
        </div>

        {/* Status banner */}
        {validation && !validation.valid && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2 text-amber-800">
              <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Configuration issues detected:</p>
                <ul className="mt-1 text-sm list-disc list-inside">
                  {validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span className="whitespace-pre-wrap">{message.text}</span>
          </div>
        )}

        {/* Content Locations */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FolderOpen size={20} className="text-gray-500" />
            Content Locations
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website Directory
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Your Astro site folder containing <code className="bg-gray-100 px-1 rounded">src/content/</code>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sitePath}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={selectSitePath}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2 text-sm"
                >
                  <FolderOpen size={16} />
                  Browse
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Media Library
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Your images and videos folder
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mediaPath}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={selectMediaPath}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2 text-sm"
                >
                  <FolderOpen size={16} />
                  Browse
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Cloudinary */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Cloud size={20} className="text-gray-500" />
            Cloudinary CDN
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Media hosting credentials. Find these in your{' '}
            <a
              href="https://console.cloudinary.com/settings/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-500 hover:underline"
            >
              Cloudinary Dashboard
            </a>
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cloud Name
              </label>
              <input
                type="text"
                value={cloudName}
                onChange={handleInputChange(setCloudName)}
                placeholder="e.g., my-cloud-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={handleInputChange(setApiKey)}
                  placeholder="Leave blank to keep existing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Secret
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={handleInputChange(setApiSecret)}
                  placeholder="Leave blank to keep existing"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Credentials are stored securely in your system keychain. Leave blank to keep existing credentials
              or use environment variables (CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).
            </p>
          </div>
        </section>

        {/* Debug Info */}
        <section className="bg-gray-100 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Configuration File</h3>
          <p className="text-xs font-mono text-gray-500 break-all">{configPath}</p>
        </section>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-colors ${
              hasChanges
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-600'
            } disabled:opacity-50`}
          >
            {saving ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
