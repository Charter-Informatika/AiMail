import React, { useState } from "react";
import { Box, Typography, Button, IconButton} from '@mui/material';
import { FaAngleRight, FaAngleLeft } from "react-icons/fa";
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Markdown from 'markdown-to-jsx';

const HelpView = ({}) => {
  const [page, setPage] = useState(0);

  // Oldalak szövegei
  const pages = [
    `Üdvözlünk az Ai Mail alkalmazásban!

Ez az alkalmazás segít automatizálni az e-mailek kezelését és válaszadását mesterséges intelligencia segítségével. 
A fő funkciók:
- Bejelentkezés Gmail vagy saját SMTP fiókkal
- Beérkezett és elküldött levelek áttekintése
- Automatikus, Félautomata vagy kézi válasz generálás AI-val
- Saját megszólítás, üdvözlés, aláírás és céges logó beállítása
- Excel adatbázis feltöltése, szerkesztése amelyet az AI a válaszokban felhasznál
- Csatolmányok kezelése, képek automatikus felismerése

A bal oldali menüben választhatsz a főoldal,  beérkezett levelek, elküldött levelek, előkészített levelek,  AI adatbázis, AI tanítás, beállítások és súgó között.`,

    `Bejelentkezés és levelek kezelése

1. Válaszd ki a bejelentkezési módot (Gmail vagy SMTP).
2. Sikeres bejelentkezés után a főoldalon látod a válaszra váró leveleket és statisztikákat.
3. A "Beérkezett levelek" menüpontban megtekintheted a leveleket, válaszolhatsz rájuk kézzel vagy AI-generált válasszal.
4. Az "Elküldött levelek" menüpontban visszanézheted a korábbi válaszaidat.
5. Az "AI adatbázis" menüpontban Excel fájlt és weboldalak linkjeit töltheted fel és szerkesztheted, amelyekből az AI információkat használhat fel a válaszokhoz.
6. Az "AI tanítás" menüpontban testreszabhatod a megszólítást, üdvözlést, aláírást, céges logót, és kezelheted a csatolmányokat.

A beállításokban módosíthatod a témát, automatikus válaszidőszakot, tiltott címeket és a megjelenítési módot is.`,

    `Fontos tudnivalók és tippek

- Az automatikus válaszküldés csak a beállított időablakban aktív, és a tiltott címekre nem válaszol.
- A félautomata mód lehetővé teszi, hogy az AI által javasolt válaszokat szerkesztve küldhesd el.
- Az Excel adatbázis feltöltése felülírja a korábbit, és minden munkalap adatait felhasználja az AI.
- A csatolmányok maximális mérete 25 MB, képek esetén az AI automatikusan leírást generál.
- A beállítások és adatok helyileg, a saját gépeden tárolódnak.
- 100 AI által generált levél vagy 90 nap után a próbaidőszak véget ér, és előfizetés szükséges a további használathoz.

További információkért keresd fel a https://okosmail.hu weboldalt vagy nézd meg a Súgó menüpontot!`
  ];

  // Oldalváltás
  const handlePrev = () => {
    if (page > 0) setPage(page - 1);
  };

  const handleNext = () => {
    if (page < pages.length - 1) {
      const newPage = page + 1;
      setPage(newPage);
    if (newPage === pages.length - 1) {
      setReachedLastPage(true);
    }
    }
  };

  // Linkek külső böngészőben nyitása
  const markdownOptions = {
  overrides: {
    a: {
      component: (props) => (
        <a
          {...props}
          onClick={e => {
            e.preventDefault();
            if (window.api?.openExternal) {
              window.api.openExternal(props.href);
            } else {
              window.open(props.href, '_blank', 'noopener,noreferrer');
            }
          }}
          style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 500, transition: 'all 0.2s ease' }}
          rel="noopener noreferrer"
        >
          {props.children}
        </a>
      ),
    },
  },
};

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        animation: 'fadeIn 0.5s ease forwards',
        '@keyframes fadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      {/* Cím középen fent */}
      <Typography
        variant="h3"
        sx={{
          mt: 4,
          mb: 6,
          alignSelf: 'center',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, currentColor 0%, rgba(99, 102, 241, 0.8) 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
        }}
      >
        Ai Mail súgó
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {/* Bal nyíl */}
        <IconButton
          onClick={handlePrev}
          disabled={page === 0}
          sx={{
            mr: 3,
            height: 56,
            width: 56,
            alignSelf: 'center',
            opacity: page === 0 ? 0.3 : 1,
            background: page === 0 ? 'transparent' : 'rgba(99, 102, 241, 0.1)',
            transition: 'all 0.2s ease',
            '&:hover': {
              background: 'rgba(99, 102, 241, 0.2)',
              transform: 'translateX(-4px)',
            },
          }}
        >
          <FaAngleLeft size={28} />
        </IconButton>

        <Card
          variant="outlined"
          sx={{
            width: 900,
            borderRadius: 4,
            minHeight: 320,
            maxHeight: 550,
            display: 'flex',
            alignItems: 'center',
            background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.08), rgba(24, 24, 27, 0.95))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.15)',
            transition: 'all 0.3s ease',
          }}
        >
          <CardContent sx={{ p: 5 }}>
            <Box
              sx={{
                fontSize: '1.15rem',
                lineHeight: 1.8,
                '& ul': { pl: 3, mb: 1 },
                '& ol': { pl: 3, mb: 1 },
                '& li': { mb: 0.5 },
                '& a': { color: 'primary.main' },
              }}
            >
              <Markdown options={markdownOptions}>{pages[page]}</Markdown>
            </Box>
          </CardContent>
        </Card>

        {/* Jobb nyíl */}
        <IconButton
          onClick={handleNext}
          disabled={page === pages.length - 1}
          sx={{
            ml: 3,
            height: 56,
            width: 56,
            alignSelf: 'center',
            opacity: page === pages.length - 1 ? 0.3 : 1,
            background: page === pages.length - 1 ? 'transparent' : 'rgba(99, 102, 241, 0.1)',
            transition: 'all 0.2s ease',
            '&:hover': {
              background: 'rgba(99, 102, 241, 0.2)',
              transform: 'translateX(4px)',
            },
          }}
        >
          <FaAngleRight size={28} />
        </IconButton>
      </Box>

      {/* Oldal jelző pöttyök */}
      <Box sx={{ display: 'flex', mt: 4, gap: 1.5 }}>
        {pages.map((_, i) => (
          <Box
            key={i}
            onClick={() => setPage(i)}
            sx={{
              width: i === page ? 28 : 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: i === page ? 'primary.main' : 'rgba(255, 255, 255, 0.3)',
              transition: 'all 0.3s ease',
              cursor: i === page ? 'default' : 'pointer',
              '&:hover': {
                backgroundColor: i === page ? 'primary.main' : 'rgba(255, 255, 255, 0.5)',
              },
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default HelpView;
