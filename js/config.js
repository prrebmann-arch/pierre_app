// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://kczcqnasnjufkgbnrbvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjemNxbmFzbmp1ZmtnYm5yYnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NjEwOTAsImV4cCI6MjA4OTEzNzA5MH0.rRAuqUkU_6Ry7nUdnfHdz_7zvCLcxgNBPgE53j_nfQc';

if (!window.supabase) {
  document.body.innerHTML = '<div style="color:red;font-size:20px;padding:40px;">ERREUR: Supabase script non chargé. Vérifiez votre connexion internet.</div>';
  throw new Error('Supabase not loaded');
}

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== GLOBAL STATE =====
let currentUser = null;
let athletesList = [];
let currentAthleteId = null;
let currentAthleteObj = null;
let currentAthleteTab = 'infos';
let currentTemplateTab = 'training';
let mealCount = 4;

// ===== PHASE DEFINITIONS =====
const PROG_PHASES = {
  seche:          { label: 'SÈCHE',          short: 'SÈCHE', color: '#c0392b' },
  reverse:        { label: 'REVERSE',        short: 'REV',   color: '#2471a3' },
  prise_de_masse: { label: 'PRISE DE MASSE', short: 'MASS',  color: '#1e8449' },
  mini_cut:       { label: 'MINI CUT',       short: 'MCUT',  color: '#e67e22' },
};
