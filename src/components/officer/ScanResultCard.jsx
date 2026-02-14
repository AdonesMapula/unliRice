// src/components/officer/ScanResultCard.jsx
import StatusBadge from '../common/StatusBadge';

export default function ScanResultCard({ result, onClose }) {
  if (!result) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'VALID':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'EXPIRED':
        return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'UNAUTHORIZED':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'STOLEN':
        return 'text-white bg-red-800 border-red-900 animate-pulse';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`mt-8 rounded-xl border shadow-lg overflow-hidden ${getStatusColor(result.overallStatus)}`}>
      {/* Header / Status */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold uppercase tracking-wide">
              {result.overallStatus}
            </h3>
            <p className="text-sm opacity-90 mt-1">
              {result.overallStatus === 'VALID' ? 'Authorized to operate' : 'Access denied / Alert'}
            </p>
          </div>
          <StatusBadge status={result.overallStatus} size="lg" />
        </div>
      </div>

      {/* Details */}
      <div className="p-6 bg-white/60">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <dt className="text-sm font-medium text-gray-600">Driver</dt>
            <dd className="mt-1 text-lg font-semibold">{result.driverName}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600">License Status</dt>
            <dd className="mt-1">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium uppercase ${
                result.licenseStatus === 'valid' ? 'bg-green-100 text-green-800' :
                result.licenseStatus === 'expired' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {result.licenseStatus}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600">Plate Number</dt>
            <dd className="mt-1 text-lg font-mono font-bold">{result.plate}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600">Authorization Type</dt>
            <dd className="mt-1 text-lg font-medium">{result.authType}</dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="p-5 bg-gray-50 border-t flex justify-end gap-3">
        {onClose && (
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Scan Another
          </button>
        )}
        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={() => window.print()}
        >
          Print Result
        </button>
      </div>
    </div>
  );
}