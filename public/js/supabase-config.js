// public/js/supabase-config.js
const SUPABASE_URL = 'https://akbcpryqjigndzpuoany.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // (Bạn giữ nguyên chuỗi Key dài của bạn nhé)
const REALTIME_API_URL = '/api/market-data';

// Khởi tạo Supabase toàn cục
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Khai báo các biến trạng thái (State) dùng chung cho toàn dự án
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
