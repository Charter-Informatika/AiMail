import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const ReplyStatsChart = ({ data }) => {
  const theme = useTheme();
  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Válaszok száma',
        data: data.map(d => d.count),
        backgroundColor: theme.palette.primary.main,
        borderRadius: 8,
        maxBarThickness: 120,
        barPercentage: 0.7,
        categoryPercentage: 0.7,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} válasz`,
        },
        backgroundColor: theme.palette.background.paper,
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.primary,
        titleFont: { size: 16 },
        bodyFont: { size: 16 },
        padding: 12,
      },
    },
    scales: {
      x: {
        title: { display: false },
        ticks: {
          color: theme.palette.text.primary,
          font: { size: 18 },
          autoSkip: false,
          maxTicksLimit: data.length,
          padding: 32,
          minRotation: 0,
          maxRotation: 0,
        },
        grid: { color: theme.palette.divider },
      },
      y: {
        title: { display: false },
        ticks: {
          color: theme.palette.text.primary,
          font: { size: 26, weight: 'bold' },
          stepSize: 1,
          padding: 16,
        },
        grid: { color: theme.palette.divider },
        beginAtZero: true,
        precision: 0,
        maxTicksLimit: 10,
      },
    },
    layout: {
      padding: { left: 60, right: 20, top: 0, bottom: 20 },
    },
  };

  return (
    <Box sx={{ 
      width: '100%', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      mt: 4, 
      mb: 2,
      animation: 'fadeIn 0.5s ease forwards',
      '@keyframes fadeIn': {
        from: { opacity: 0, transform: 'translateY(10px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}>
      <Paper sx={{
        background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.05) 0%, rgba(30, 30, 40, 0.95) 100%)',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 1200,
        mx: 'auto',
        p: 3,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: 3,
        minHeight: 350,
      }}>
        <Typography 
          variant="h6" 
          gutterBottom 
          sx={{ 
            fontSize: 18, 
            textAlign: 'center', 
            mb: 2, 
            mt: 1, 
            fontWeight: 600,
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AI által megválaszolt levelek az elmúlt 5 napban
        </Typography>
        <Box sx={{ width: '100%', height: 300 }}>
          <Bar data={chartData} options={{
            ...options,
            scales: {
              x: {
                ...options.scales.x,
                ticks: {
                  ...options.scales.x.ticks,
                  font: { size: 12 },
                  padding: 8,
                },
              },
              y: {
                ...options.scales.y,
                ticks: {
                  ...options.scales.y.ticks,
                  font: { size: 12, weight: 'bold' },
                  padding: 8,
                },
              },
            },
            layout: {
              padding: { left: 30, right: 10, top: 0, bottom: 10 },
            },
            plugins: {
              ...options.plugins,
              tooltip: {
                ...options.plugins.tooltip,
                titleFont: { size: 12 },
                bodyFont: { size: 12 },
                padding: 8,
              },
            },
          }} />
        </Box>
      </Paper>
    </Box>
  );
};

export default ReplyStatsChart; 