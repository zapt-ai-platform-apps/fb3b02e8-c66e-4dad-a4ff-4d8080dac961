import React from 'react';
import ImageUploader from './components/ImageUploader';
import DescriptionResult from './components/DescriptionResult';
import useImageAnalysis from './hooks/useImageAnalysis';

export default function App() {
  const { description, isLoading, error, analyzeImage } = useImageAnalysis();
  
  const handleImageSelected = (file) => {
    analyzeImage(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="text-3xl font-bold mb-2">Image Describer</h1>
          <p className="text-gray-600">Upload an image to get a detailed description</p>
        </header>
        
        <main className="bg-white rounded-xl shadow-sm p-6 md:p-8">
          <ImageUploader onImageSelected={handleImageSelected} isLoading={isLoading} />
          <DescriptionResult 
            description={description} 
            isLoading={isLoading} 
            error={error} 
          />
        </main>
        
        <footer className="mt-12 text-center text-sm text-gray-500">
          <div className="mb-4">
            <a 
              href="https://www.zapt.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-block text-blue-600 hover:text-blue-800"
            >
              Made on ZAPT
            </a>
          </div>
          <p>© {new Date().getFullYear()} Image Describer. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}