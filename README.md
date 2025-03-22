# Image Describer

A web application that allows users to upload images and get detailed descriptions generated through AI analysis.

## Features

- Image upload via drag-and-drop or file selection
- AI-powered image analysis
- Detailed descriptions of image content
- Responsive design for all devices

## Technologies Used

- React
- Tailwind CSS
- Google Cloud Vision API for image analysis
- Vercel for deployment

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env` file with the required environment variables
4. Run the development server with `npm run dev`

## How It Works

1. User uploads an image through the interface
2. The image is sent to the server
3. The server calls the Google Cloud Vision API to analyze the image
4. A detailed description is generated based on the analysis
5. The description is returned to the user interface

## Deployment

This application is configured for deployment on Vercel.