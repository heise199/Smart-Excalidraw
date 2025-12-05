'use client';

export default function LoadingOverlay({
  isVisible,
  message = "处理中...",
  progress = null, // 0-100
  transparent = false,
  className = ""
}) {
  if (!isVisible) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center ${
        transparent
          ? 'bg-black bg-opacity-10'
          : 'bg-white bg-opacity-90'
      } ${className}`}
    >
      <div className="flex flex-col items-center space-y-4 w-full max-w-sm px-6">
        {/* Loading Spinner */}
        <div className="relative">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></div>
        </div>

        {/* Loading Message */}
        <div className="flex flex-col items-center space-y-2 w-full">
          <span className="text-sm text-gray-700 font-medium text-center">{message}</span>
          
          {/* Progress Bar */}
          {progress !== null && (
            <div className="w-full">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gray-900 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 text-center mt-1">{progress}%</div>
            </div>
          )}
          
          {/* Loading Dots (only show if no progress) */}
          {progress === null && (
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-gray-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}