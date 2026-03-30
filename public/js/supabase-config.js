const SUPABASE_URL = 'https://akbcpryqjigndzpuoany.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYmNwcnlxamlnbmR6cHVvYW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODg0NTEsImV4cCI6MjA4MDY2NDQ1MX0.p1lBHZ12fzyIrKiSL7DXv7VH74cq3QcU7TtBCJQBH9M';
const REALTIME_API_URL = '/api/market-data';

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let layer2Interval = null;
let wsSocket = null;            
let isRealtimeActive = false; 
const PREDICT_FEE = 100;
let accSettings = JSON.parse(localStorage.getItem('wave_settings')) || [];
let siteConfig = {};
let userProfile = {};
let currentUser = null;
let mySonarGalaxy = null;

let tokenVolHistory = {}; 
const SAFETY_WINDOW = 10; 
let currentFilterDate = null;
let currentLang = localStorage.getItem('wave_lang') || 'en';
