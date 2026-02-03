import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const CenteredLoading = ({ size = 72, text = 'Betöltés...', helperText = null, minHeight = '160px' }) => {
  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      width: '100%', 
      py: 4, 
      minHeight,
      animation: 'fadeIn 0.3s ease forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0 },
        to: { opacity: 1 },
      },
    }}>
      {/* Top title */}
      <Typography 
        variant="h5" 
        sx={{ 
          mb: 2, 
          fontWeight: 600, 
          textAlign: 'center',
          background: 'linear-gradient(135deg, currentColor 0%, rgba(99, 102, 241, 0.7) 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
        }}
      >
        {text}
      </Typography>

      {/* Helper text larger and centered under the spinner */}
      {helperText && (
        <Typography 
          variant="body1" 
          sx={{ 
            mt: 1, 
            textAlign: 'center', 
            maxWidth: 800, 
            fontSize: '1.05rem', 
            mb: 2,
            color: 'text.secondary',
          }}
        >
          {helperText}
        </Typography>
      )}

      {/* Spinner centered under the title with glow effect */}
      <Box sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mb: 2,
      }}>
        <Box sx={{
          position: 'absolute',
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 0.5, transform: 'scale(1)' },
            '50%': { opacity: 1, transform: 'scale(1.1)' },
          },
        }} />
        <CircularProgress 
          size={size} 
          sx={{ 
            color: 'primary.main',
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
            },
          }} 
        />
      </Box>
    </Box>
  );
};

export default CenteredLoading;
