import React from 'react';

const DescriptionResult = ({ description, isLoading, error }) => {
  // Split the description into sentences for better presentation
  const sentences = description ? description.match(/[^\.!\?]+[\.!\?]+/g) || [description] : [];
  
  return (
    <div className="mt-8 border rounded-lg p-6 bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Image Description</h2>
      
      {isLoading ? (
        <div className="flex flex-col items-center py-6">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Analyzing your image...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">Error: {error}</p>
          <p className="text-sm text-red-500 mt-2">Please try again with a different image.</p>
        </div>
      ) : description ? (
        <div className="prose max-w-none">
          {sentences.length > 1 ? (
            <ul className="space-y-2 list-disc pl-5 text-gray-800">
              {sentences.map((sentence, index) => (
                <li key={index} className="leading-relaxed">{sentence.trim()}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-800 leading-relaxed">{description}</p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 italic">Upload an image to see its description here.</p>
      )}
    </div>
  );
};

export default DescriptionResult;