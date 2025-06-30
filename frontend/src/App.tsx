import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Beauty Salon System
          </h1>
          <p className="text-gray-600 mb-8">
            Sistema de gerenciamento para salão de beleza
          </p>
          
          <div className="space-y-4">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">
              Agendar Horário
            </button>
            
            <button className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">
              Ver Serviços
            </button>
            
            <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">
              Área do Cliente
            </button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              React + TypeScript + Tailwind CSS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
