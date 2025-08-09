# Gesture-Controlled Labyrinth Game

An innovative maze game controlled entirely by hand gestures using MediaPipe motion tracking.

## Features

- 🎥 **Hand Gesture Controls**: Move your hand relative to your face to control the player
- 🧩 **Strategic Mazes**: Multiple paths and escape routes using Prim's algorithm
- 👻 **Smart AI Enemies**: Intelligent ghost pathfinding that hunts the player
- 🎵 **Immersive Audio**: Background music and realistic footstep sounds
- 💀 **Dramatic Game Over**: 30-second "THE END" experience when caught

## Technology Stack

- **Frontend**: Pure JavaScript with Phaser 3 game engine
- **Motion Tracking**: MediaPipe Holistic for face and hand detection
- **Audio**: Web Audio API with Ogg/MP3 support
- **Deployment**: Docker + Nginx for production serving

## Requirements

- Modern web browser with webcam support
- HTTPS connection (required for camera access)
- Camera permissions

## Local Development

1. Clone the repository
2. Start a local web server:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser
4. Allow camera access when prompted

## Deployment with Dokploy

1. **Connect Repository**: Link this GitHub repository to your Dokploy instance
2. **Domain Configured**: Set to `videogame.5pointers.com`
3. **Deploy**: Dokploy will automatically build and deploy using the included Docker configuration
4. **HTTPS Required**: Ensure SSL/TLS is enabled for camera access

### Deployment Files

- `Dockerfile`: Container configuration
- `docker-compose.yml`: Service orchestration
- `nginx.conf`: Web server configuration
- `dokploy.json`: Deployment settings

## Game Controls

1. **Position** your face in front of the camera
2. **Raise your right hand** so it's visible
3. **Move hand relative to face**:
   - Hand right of face → Move right
   - Hand left of face → Move left
   - Hand above face → Move up
   - Hand below face → Move down
4. **Avoid the ghosts** and **reach the green goal**!

## Important Notes

- **HTTPS Required**: Camera access requires secure connection
- **Webcam Permissions**: Browser will request camera access
- **Hand Visibility**: Keep right hand visible to camera for controls
- **Lighting**: Good lighting improves tracking accuracy

Enjoy the future of gaming! 🎮✨
