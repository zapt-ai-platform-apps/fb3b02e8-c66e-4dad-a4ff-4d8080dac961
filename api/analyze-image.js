import * as Sentry from '@sentry/node';
import { initializeZapt } from '@zapt/zapt-js';
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';

// Initialize Sentry for backend error tracking
Sentry.init({
  dsn: process.env.VITE_PUBLIC_SENTRY_DSN,
  environment: process.env.VITE_PUBLIC_APP_ENV,
  initialScope: {
    tags: {
      type: 'backend',
      projectId: process.env.VITE_PUBLIC_APP_ID
    }
  }
});

// Disable body parsing for FormData
export const config = {
  api: {
    bodyParser: false
  }
};

const { supabase } = initializeZapt(process.env.VITE_PUBLIC_APP_ID);

export default async function handler(req, res) {
  try {
    console.log('Received image analysis request');
    
    // Only accept POST requests
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Parse form data with formidable
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    // Parse the form
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    console.log('Image file received');

    if (!files.image) {
      console.log('No image file found in request');
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
    const imagePath = imageFile.filepath;
    const imageBuffer = fs.readFileSync(imagePath);
    
    console.log('Image loaded, preparing to analyze');

    // Use Vision API for image analysis
    const apiKey = process.env.VISION_API_KEY;
    
    if (!apiKey) {
      console.error('VISION_API_KEY is not defined');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Call Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: imageBuffer.toString('base64'),
              },
              features: [
                {
                  type: 'LABEL_DETECTION',
                  maxResults: 10,
                },
                {
                  type: 'OBJECT_LOCALIZATION',
                  maxResults: 5,
                },
                {
                  type: 'IMAGE_PROPERTIES',
                  maxResults: 5,
                },
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 5,
                },
              ],
            },
          ],
        }),
      }
    );

    const visionData = await visionResponse.json();
    
    if (!visionResponse.ok) {
      console.error('Vision API error:', visionData);
      Sentry.captureException(new Error(`Vision API error: ${JSON.stringify(visionData)}`));
      return res.status(500).json({ error: 'Failed to analyze image' });
    }
    
    console.log('Vision API response received');

    // Extract data from the Vision API response
    const response = visionData.responses[0];
    
    // Generate a detailed description based on the vision analysis
    let description = generateDescription(response);
    
    console.log('Description generated:', description.substring(0, 100) + '...');

    // Clean up the temporary file
    fs.unlinkSync(imagePath);

    return res.status(200).json({ description });
  } catch (error) {
    console.error('Error processing image:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Failed to analyze image' });
  }
}

function generateDescription(visionResponse) {
  try {
    let description = '';
    
    // Get image labels
    const labels = visionResponse.labelAnnotations || [];
    if (labels.length > 0) {
      const mainSubjects = labels.slice(0, 3).map(label => label.description).join(', ');
      description += `This image shows ${mainSubjects}. `;
    }
    
    // Get objects
    const objects = visionResponse.localizedObjectAnnotations || [];
    if (objects.length > 0) {
      description += 'It contains ';
      description += objects.map((obj, index) => {
        const article = 'aeiou'.includes(obj.name[0].toLowerCase()) ? 'an' : 'a';
        return `${index > 0 ? (index === objects.length - 1 ? ' and ' : ', ') : ''}${article} ${obj.name.toLowerCase()}`;
      }).join('');
      description += '. ';
    }
    
    // Get colors
    const colorInfo = visionResponse.imagePropertiesAnnotation?.dominantColors?.colors || [];
    if (colorInfo.length > 0) {
      const sortedColors = colorInfo.sort((a, b) => b.score - a.score).slice(0, 3);
      const colorNames = sortedColors.map(color => {
        const { red, green, blue } = color.color;
        return getColorName(red, green, blue);
      });
      description += `The dominant colors in the image are ${colorNames.join(', ')}. `;
    }
    
    // Get text
    const textAnnotations = visionResponse.textAnnotations || [];
    if (textAnnotations.length > 0 && textAnnotations[0]?.description) {
      const text = textAnnotations[0].description.replace(/\n/g, ' ').trim();
      if (text && text.length > 0) {
        if (text.length > 100) {
          description += `The image contains text including: "${text.substring(0, 100)}...". `;
        } else {
          description += `The image contains text that reads: "${text}". `;
        }
      }
    }
    
    // If description is empty (no data from API), provide a fallback
    if (!description) {
      description = 'This image could not be analyzed in detail. Please try uploading a clearer image.';
    }
    
    return description;
  } catch (error) {
    console.error('Error generating description:', error);
    Sentry.captureException(error);
    return 'An image containing various elements. The system couldn\'t generate a more detailed description.';
  }
}

function getColorName(red, green, blue) {
  // Simple color naming algorithm
  if (red > 200 && green < 100 && blue < 100) return 'red';
  if (red < 100 && green > 200 && blue < 100) return 'green';
  if (red < 100 && green < 100 && blue > 200) return 'blue';
  if (red > 200 && green > 200 && blue < 100) return 'yellow';
  if (red > 200 && green < 100 && blue > 200) return 'magenta';
  if (red < 100 && green > 200 && blue > 200) return 'cyan';
  if (red > 200 && green > 150 && blue > 100) return 'orange';
  if (red > 200 && green < 100 && blue > 150) return 'purple';
  if (red > 200 && green > 200 && blue > 200) return 'white';
  if (red < 100 && green < 100 && blue < 100) return 'black';
  if (red > 100 && red < 200 && green > 100 && green < 200 && blue > 100 && blue < 200) return 'gray';
  return 'mixed';
}