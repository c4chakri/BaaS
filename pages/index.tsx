'use client'

import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-6">
      <div className="relative bg-gray-800 rounded-xl p-10 shadow-lg w-full max-w-3xl text-center">
        
        {/* Circular Background Element */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-gray-700 rounded-full opacity-30 blur-3xl"></div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-300">
          Blockchain Enterprise
        </h1>

        {/* Subtitle */}
        <p className="text-gray-300 mt-4">
          Secure, scalable, and customizable blockchain solutions.
        </p>

        {/* Icons Section */}
        <div className="flex justify-center gap-4 mt-6">
          <div className="bg-gray-700 p-3 rounded-lg shadow-md">
            🔗 {/* Blockchain Icon */}
          </div>
          <div className="bg-gray-700 p-3 rounded-lg shadow-md">
            📜 {/* Smart Contracts Icon */}
          </div>
          <div className="bg-gray-700 p-3 rounded-lg shadow-md">
            🚀 {/* Decentralization Icon */}
          </div>
          <div className="bg-gray-700 p-3 rounded-lg shadow-md">
            ⚙️ {/* Customization Icon */}
          </div>
        </div>

        {/* Call to Action */}
        <button onClick={() => router.push('/create-blockchain')} className="mt-6 px-6 py-3 bg-orange-500 text-black font-semibold rounded-lg shadow-lg hover:bg-yellow-400 transition">
          Create Blockchain
        </button>
      </div>
    </div>
  );
}
