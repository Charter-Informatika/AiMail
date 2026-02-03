import React, { useState, useEffect } from 'react';
import { TextField, Button, Box, Typography } from '@mui/material';

export default function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    const key = await window.api.getApiKey();
    setApiKey(key);
  };

  const handleSave = async () => {
    await window.api.setApiKey(apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Box sx={{ 
      p: 3,
      animation: 'fadeIn 0.3s ease forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0, transform: 'translateY(8px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      <Typography 
        variant="h6" 
        gutterBottom
        sx={{
          fontWeight: 600,
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        OpenAI API Kulcs Beállítások
      </Typography>
      <TextField
        fullWidth
        label="OpenAI API Kulcs"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        margin="normal"
        type="password"
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            background: 'rgba(0, 0, 0, 0.2)',
          },
        }}
      />
      <Button
        variant="contained"
        onClick={handleSave}
        sx={{ 
          mt: 2,
          background: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
          color: '#fff',
          fontWeight: 600,
          borderRadius: 2,
          px: 3,
          boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)',
          transition: 'all 0.2s ease',
          '&:hover': { 
            background: 'linear-gradient(135deg, #4ade80 0%, #34d399 100%)',
            transform: 'translateY(-2px)',
          },
        }}
      >
        Mentés
      </Button>
      {saved && (
        <Typography 
          sx={{ 
            mt: 2,
            p: 1.5,
            background: 'rgba(34, 197, 94, 0.15)',
            borderRadius: 2,
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#22c55e',
            fontWeight: 500,
          }}
        >
          API kulcs sikeresen mentve!
        </Typography>
      )}
    </Box>
  );
} 