import { useState } from 'react';
import * as Sentry from '@sentry/browser';

const useImageAnalysis = () => {
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeImage = async (imageFile) => {
    if (!imageFile) return;

    setIsLoading(true);
    setError(null);
    setDescription('');

    try {
      console.log('Preparing to analyze image:', imageFile.name);
      
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Received response from API:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze image');
      }
      
      const data = await response.json();
      console.log('Image analysis completed successfully');
      
      setDescription(data.description);
    } catch (err) {
      console.error('Error analyzing image:', err);
      Sentry.captureException(err);
      setError(err.message || 'An error occurred while analyzing the image');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    description,
    isLoading,
    error,
    analyzeImage,
  };
};

export default useImageAnalysis;