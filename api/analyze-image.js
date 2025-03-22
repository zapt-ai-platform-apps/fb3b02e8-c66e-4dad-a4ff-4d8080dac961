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

    // Call Google Vision API with expanded feature requests
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
                  maxResults: 15,
                },
                {
                  type: 'OBJECT_LOCALIZATION',
                  maxResults: 10,
                },
                {
                  type: 'IMAGE_PROPERTIES',
                  maxResults: 5,
                },
                {
                  type: 'TEXT_DETECTION',
                  maxResults: 10,
                },
                {
                  type: 'FACE_DETECTION',
                  maxResults: 5,
                },
                {
                  type: 'LANDMARK_DETECTION',
                  maxResults: 5,
                },
                {
                  type: 'LOGO_DETECTION',
                  maxResults: 5,
                },
                {
                  type: 'WEB_DETECTION',
                  maxResults: 5,
                }
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

    return res.status(200).json({ description, detailedAnalysis: response });
  } catch (error) {
    console.error('Error processing image:', error);
    Sentry.captureException(error);
    return res.status(500).json({ error: 'Failed to analyze image' });
  }
}

function generateDescription(visionResponse) {
  try {
    let description = '';
    
    // Extract scene type/context
    const labels = visionResponse.labelAnnotations || [];
    const contexts = labels.filter(label => 
      ['indoor', 'outdoor', 'city', 'rural', 'landscape', 'portrait', 'closeup', 'macro'].includes(label.description.toLowerCase())
    );
    
    if (contexts.length > 0) {
      description += `This appears to be an ${contexts[0].description.toLowerCase()} image. `;
    }
    
    // Get image categories and themes
    if (labels.length > 0) {
      const mainSubjects = labels.slice(0, 4).map(label => label.description).join(', ');
      description += `The image shows ${mainSubjects}. `;
    }
    
    // Detect landmarks
    const landmarks = visionResponse.landmarkAnnotations || [];
    if (landmarks.length > 0) {
      description += `The image features ${landmarks[0].description}`;
      if (landmarks[0].locations && landmarks[0].locations.length > 0) {
        const lat = landmarks[0].locations[0].latLng.latitude;
        const lng = landmarks[0].locations[0].latLng.longitude;
        description += `, located at approximately ${Math.abs(lat)}° ${lat >= 0 ? 'North' : 'South'}, ${Math.abs(lng)}° ${lng >= 0 ? 'East' : 'West'}`;
      }
      description += '. ';
    }
    
    // Detect people and faces
    const faceAnnotations = visionResponse.faceAnnotations || [];
    if (faceAnnotations.length > 0) {
      description += `There ${faceAnnotations.length === 1 ? 'is' : 'are'} ${faceAnnotations.length} ${faceAnnotations.length === 1 ? 'person' : 'people'} in the image. `;
      
      // Extract emotions
      const emotionCounts = { joy: 0, sorrow: 0, anger: 0, surprise: 0 };
      faceAnnotations.forEach(face => {
        if (face.joyLikelihood === 'VERY_LIKELY' || face.joyLikelihood === 'LIKELY') emotionCounts.joy++;
        if (face.sorrowLikelihood === 'VERY_LIKELY' || face.sorrowLikelihood === 'LIKELY') emotionCounts.sorrow++;
        if (face.angerLikelihood === 'VERY_LIKELY' || face.angerLikelihood === 'LIKELY') emotionCounts.anger++;
        if (face.surpriseLikelihood === 'VERY_LIKELY' || face.surpriseLikelihood === 'LIKELY') emotionCounts.surprise++;
      });
      
      const emotions = Object.entries(emotionCounts)
        .filter(([_, count]) => count > 0)
        .map(([emotion, count]) => `${count} ${count === 1 ? 'appears' : 'appear'} to be ${emotion === 'joy' ? 'happy' : emotion}`);
      
      if (emotions.length > 0) {
        description += `Of these, ${emotions.join(', ')}. `;
      }
    }
    
    // Get objects with their locations
    const objects = visionResponse.localizedObjectAnnotations || [];
    if (objects.length > 0) {
      // Group similar objects
      const objectCounts = objects.reduce((acc, obj) => {
        acc[obj.name] = (acc[obj.name] || 0) + 1;
        return acc;
      }, {});
      
      const objectDescriptions = Object.entries(objectCounts).map(([name, count]) => {
        return count > 1 ? `${count} ${name.toLowerCase()}s` : `a ${name.toLowerCase()}`;
      });
      
      if (objectDescriptions.length > 0) {
        description += `The image contains ${objectDescriptions.join(', ')}. `;
        
        // Describe spatial relationships for multiple objects
        if (objects.length >= 2) {
          // We could add relative positioning (e.g., "The cat is to the left of the dog")
          // But this would require more complex analysis of bounding boxes
        }
      }
    }
    
    // Detect logos
    const logos = visionResponse.logoAnnotations || [];
    if (logos.length > 0) {
      const logoNames = logos.map(logo => logo.description).join(', ');
      description += `The image contains the following ${logos.length === 1 ? 'logo' : 'logos'}: ${logoNames}. `;
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
    
    // Web entities and similar images
    const webDetection = visionResponse.webDetection || {};
    const webEntities = webDetection.webEntities || [];
    
    if (webEntities.length > 0) {
      const topEntities = webEntities
        .filter(entity => entity.score > 0.5)
        .slice(0, 3)
        .map(entity => entity.description);
        
      if (topEntities.length > 0) {
        description += `The image is associated with ${topEntities.join(', ')}. `;
      }
    }
    
    // Add image quality assessment
    if (visionResponse.imageQualityAnnotation) {
      const quality = visionResponse.imageQualityAnnotation.quality;
      if (quality > 0.8) {
        description += "This is a high-quality image. ";
      } else if (quality < 0.4) {
        description += "The image quality is relatively low. ";
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
  // More sophisticated color naming algorithm
  if (red > 220 && green > 220 && blue > 220) return 'white';
  if (red < 30 && green < 30 && blue < 30) return 'black';
  
  // Primary colors
  if (red > 200 && green < 70 && blue < 70) return 'red';
  if (red < 70 && green > 200 && blue < 70) return 'green';
  if (red < 70 && green < 70 && blue > 200) return 'blue';
  
  // Secondary colors
  if (red > 200 && green > 200 && blue < 70) return 'yellow';
  if (red > 200 && green < 70 && blue > 200) return 'magenta';
  if (red < 70 && green > 200 && blue > 200) return 'cyan';
  
  // Tertiary colors
  if (red > 200 && green > 120 && green < 180 && blue < 70) return 'orange';
  if (red > 120 && red < 200 && green < 70 && blue > 200) return 'purple';
  if (red > 70 && red < 120 && green > 200 && blue < 70) return 'lime';
  if (red < 70 && green > 130 && green < 200 && blue > 200) return 'teal';
  if (red > 200 && green < 70 && blue > 130 && blue < 200) return 'pink';
  if (red > 150 && green > 150 && blue < 70) return 'gold';
  
  // Gray shades
  if (Math.abs(red - green) < 30 && Math.abs(red - blue) < 30 && Math.abs(green - blue) < 30) {
    if (red < 80) return 'dark gray';
    if (red < 150) return 'gray';
    return 'light gray';
  }
  
  // Brown tones
  if (red > 130 && red < 200 && green > 70 && green < 130 && blue < 70) {
    return 'brown';
  }
  
  return 'mixed';
}