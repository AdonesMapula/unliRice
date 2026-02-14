// src/components/common/LoadingSpinner.jsx
export default function LoadingSpinner({ size = 'md', message = 'Loading...' }) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16',
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizes[size] || sizes.md}`}></div>
      {message && <p className="mt-4 text-gray-600">{message}</p>}
    </div>
  );
}