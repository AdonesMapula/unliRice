// src/components/common/StatusBadge.jsx
export default function StatusBadge({ status, size = 'md' }) {
  const colors = {
    VALID: 'bg-green-100 text-green-800 border-green-300',
    EXPIRED: 'bg-orange-100 text-orange-800 border-orange-300',
    UNAUTHORIZED: 'bg-red-100 text-red-800 border-red-300',
    STOLEN: 'bg-red-800 text-white border-red-900 animate-pulse',
  };

  const sizes = {
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-xl font-bold',
  };

  return (
    <span
      className={`inline-block rounded-full border font-semibold ${colors[status] || 'bg-gray-100 text-gray-800'} ${sizes[size]}`}
    >
      {status}
    </span>
  );
}