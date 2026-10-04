// ══ v62: ไอคอนลายเส้นวาดมือ ══
// แทนไอคอน Font Awesome (<i class="fa-solid fa-xxx">) ด้วย SVG ลายเส้นวาดมือ โดยไม่ต้องแก้ markup เดิม
// - ไอคอนที่ไม่มีในชุดนี้ (และไอคอนหมุน fa-spin / แบรนด์) ยังใช้ Font Awesome ตามเดิม
// - ตั้งค่าได้ที่ ตั้งค่า → ไอคอน : สไตล์ (วาดมือ / มาตรฐาน) และสีของไอคอน
// โหลดใน <head> เพื่อแปลงไอคอนตั้งแต่ตอนหน้าเว็บกำลังโหลด (ไม่กระพริบ)
(function(){
  const CIRC = 'M19 9.2 C20.5 13.7 17.3 19.6 11.8 19.6 C7.4 19.6 4.3 16.2 4.4 12 C4.5 7.6 8 4.3 12.2 4.4 C14.6 4.5 16.6 5.6 17.9 7.4';
  const FILE = 'M14.2 3.6 H6.6 Q5.7 3.6 5.8 4.5 V19.8 Q5.8 20.6 6.6 20.6 H17.8 Q18.6 20.6 18.6 19.8 V8|M14 3.7 V8.2 H18.7 L14.2 3.5';
  const CLIP = 'M8.6 5.2 H6.4 Q5.4 5.2 5.4 6.2 V19.6 Q5.4 20.6 6.4 20.6 H17.6 Q18.6 20.6 18.6 19.6 V6.2 Q18.6 5.2 17.6 5.2 H15.4|M9.1 3.6 H14.9 Q15.2 5.2 14.9 6.9 H9.1 Q8.8 5.2 9.1 3.6';
  const CAL  = 'M4.6 6.6 Q4.5 5.5 5.6 5.5 H18.5 Q19.6 5.5 19.5 6.6 V18.9 Q19.6 20 18.5 19.9 H5.7 Q4.5 20 4.6 18.9 Z|M4.8 10.1 Q12 9.8 19.3 10.2|M8.4 3.5 V7.2|M15.6 3.4 V7.3';
  const SHIELD = 'M12 3.4 Q16 5.4 19.4 5.6 Q19.6 15.6 12 20.6 Q4.4 15.6 4.6 5.6 Q8 5.4 12 3.4';
  const EYE = 'M2.8 12 Q7 5.6 12 5.6 Q17 5.6 21.2 12 Q17 18.4 12 18.4 Q7 18.4 2.8 12|M14.8 11.2 C15.2 13 13.8 14.8 12 14.8 C10.4 14.8 9.2 13.6 9.2 12 C9.2 10.4 10.4 9.2 12 9.2';
  const RECT = 'M4.6 5.6 Q4.5 4.5 5.6 4.6 H18.4 Q19.5 4.5 19.4 5.6 V18.4 Q19.5 19.5 18.4 19.4 H5.6 Q4.5 19.5 4.6 18.4 Z';
  const THUMB = 'M7.4 10.4 V19.6 H4.4 V10.4 Z|M7.6 10.4 L11.2 4.4 Q13.4 4.4 13 7.4 L12.6 9.6 H18 Q19.8 9.8 19.4 11.8 L18 18 Q17.6 19.6 16 19.6 H7.6';
  const RUN = 'M15.4 3.4 C16.6 3.3 17.4 4.2 17.3 5.2 C17.2 6.3 16.3 6.9 15.4 6.8 C14.4 6.7 13.7 5.9 13.8 5 C13.9 4.2 14.5 3.6 15.2 3.5|M10.4 8.8 L14.4 8.3 L12.9 13.3 L16.5 15.6 L15.6 20.2|M12.9 13.3 L10.6 16.7 L6.6 17.1|M10.4 8.8 L7.9 11.7|M14.4 8.3 L17.2 11.2 L19.6 10.5';

  const P = {
    'house': 'M3.4 11.4 L12.1 4 L20.7 11.2|M5.9 9.6 V19.4 Q5.9 20.3 6.8 20.2 H17.4 Q18.3 20.2 18.3 19.3 V9.4|M10 20 V15.2 Q12 14.2 14.1 15.1 V20',
    'file-lines': FILE+'|M8.6 12.2 Q12 11.9 15.4 12.1|M8.7 15.8 H13.4',
    'file-arrow-up': FILE+'|M12 17.6 V11.2|M9.4 13.6 L12 11 L14.6 13.6',
    'file-import': FILE+'|M12 10.8 V17.2|M9.4 14.6 L12 17.2 L14.6 14.6',
    'plus': 'M12.1 5 Q12.3 12 11.9 19|M5.1 12.2 Q12 11.7 18.9 12.1',
    'calendar': CAL+'|M8.6 13.8 h0.1|M12 13.9 h0.1|M15.4 13.8 h0.1|M8.6 16.9 h0.1|M12 17 h0.1',
    'calendar-week': CAL+'|M8 14.6 Q12 14.3 16 14.7',
    'calendar-day': CAL+'|M9.4 13.4 H12.6 V16.4 H9.4 Z',
    'chart-line': 'M4 4 V19.4 Q4 20.1 4.7 20.1 H20.4|M7.2 15.6 L10.6 11.3 L13.5 13.9 L19 7.4|M15.7 7.1 L19.2 7.2 L19.1 10.7',
    'chart-column': 'M4.2 20.2 Q12 19.9 20 20.2|M6.6 16.6 V11.4|M10.6 16.6 V7.2|M14.6 16.6 V12.6|M18.6 16.6 V4.6',
    'chart-simple': 'M6.6 19.6 V12|M12 19.6 V5.4|M17.4 19.6 V9.4',
    'grip': 'M4.4 6.9 Q12 6.3 19.6 7.1|M4.5 12.1 Q11 11.8 19.4 12.2|M4.4 17.2 Q9 16.8 14.2 17.1',
    'bullseye': 'M19 9.2 C20.5 13.7 17.3 19.6 11.8 19.6 C7.4 19.6 4.3 16.2 4.4 12 C4.5 7.6 8 4.3 12.2 4.4 C13.6 4.4 14.8 4.8 15.8 5.4|M14.9 10.7 C15.6 12.7 14.2 15 12 15 C10.2 15 9 13.6 9 12 C9 10.2 10.4 9 12.1 9|M12 12 L20 4|M17.1 3.7 L20.3 3.6 L20.3 6.9',
    'crosshairs': CIRC+'|M12 2.6 V6.6|M12 17.4 V21.4|M2.6 12 H6.6|M17.4 12 H21.4',
    'fire': 'M12.2 20.6 C8.2 20.6 5.6 18 5.7 14.4 C5.8 10.8 8.6 9 9.4 5.4 C11.6 7.1 12.3 9.4 11.8 11.4 C13 10.6 13.8 9.2 13.7 7.4 C16.6 9.5 18.4 12.4 18.3 15 C18.2 18.2 15.8 20.6 12.2 20.6|M12 20.3 C10.5 20.2 9.6 19 9.8 17.6 C10 16.2 11.2 15.5 11.8 14 C13.4 15.2 14.4 16.6 14.2 18 C14 19.4 13.2 20.2 12.1 20.3',
    'hand': 'M7.6 13.2 V6.6 Q7.6 5.2 8.8 5.2 Q10 5.2 10 6.6 V11.2|M10 10.8 V4.8 Q10 3.4 11.2 3.4 Q12.4 3.5 12.4 4.8 V11|M12.4 10.8 V5.6 Q12.5 4.3 13.6 4.3 Q14.8 4.4 14.8 5.6 V11.4|M14.8 11 V7.6 Q14.9 6.4 16 6.4 Q17.1 6.5 17.1 7.6 V14.2 C17.1 18.2 14.8 20.6 11.6 20.6 C9.4 20.6 8 19.6 6.8 17.8 L4.7 14.3 Q4.1 13.1 5.1 12.5 Q6.1 12 6.9 12.9 L7.6 13.8',
    'triangle-exclamation': 'M10.5 4.8 Q12 2.7 13.5 4.8 L20.6 17.6 Q21.4 19.6 19.3 19.6 H4.8 Q2.7 19.7 3.4 17.7 L10.3 5.2|M12 9.2 Q12.2 11.6 12 13.8|M12 16.7 h0.1',
    'check': 'M4.4 12.6 L9.3 17.5 Q13.8 10.2 20 5.6',
    'circle-check': CIRC+'|M8.4 12.4 L11 15 L16 9.4',
    'circle-info': CIRC+'|M12 11 V16.4|M12 7.9 h0.1',
    'ban': CIRC+'|M6.6 6.8 L17.4 17.4',
    'plug-circle-xmark': CIRC+'|M9.4 9.4 L14.6 14.6|M14.6 9.4 L9.4 14.6',
    'circle-half-stroke': CIRC+'|M12 4.6 V19.4|M12 8.4 L15.4 5.6|M12 12.4 L18.2 7.8|M12 16.4 L18.8 11.8',
    'clipboard-list': CLIP+'|M8.6 11.1 Q12 10.8 15.4 11|M8.6 14.5 H15.1|M8.7 17.7 H12.4',
    'clipboard-check': CLIP+'|M8.8 13.4 L11 15.6 L15.4 10.8',
    'paste': 'M8.6 5.2 H6.4 Q5.4 5.2 5.4 6.2 V19.6 Q5.4 20.6 6.4 20.6 H10.6|M15.4 5.2 H17.6 Q18.6 5.2 18.6 6.2 V9.2|M9.1 3.6 H14.9 Q15.2 5.2 14.9 6.9 H9.1 Q8.8 5.2 9.1 3.6|M12.6 11 H19.6 V20.6 H12.6 Z',
    'pen-to-square': 'M11.4 4.6 H6.2 Q4.6 4.6 4.6 6.2 V17.8 Q4.6 19.4 6.2 19.4 H17.8 Q19.4 19.4 19.4 17.8 V12.6|M17.6 3.5 Q18.6 2.6 19.6 3.6 L20.4 4.4 Q21.3 5.4 20.4 6.4 L12.6 14.2 L9.3 14.9 L10 11.6 L17.6 3.5',
    'pen': 'M15.6 4.6 Q16.8 3.4 18 4.6 L19.4 6 Q20.6 7.2 19.4 8.4 L8.4 19.4 L4.4 19.8 L4.8 15.6 Z|M14 6.4 L17.6 10',
    'camera': 'M4.4 8.2 Q4.4 7 5.6 7 H8 L9.6 4.8 H14.4 L16 7 H18.4 Q19.6 7 19.6 8.2 V18 Q19.6 19.2 18.4 19.2 H5.6 Q4.4 19.2 4.4 18 Z|M15.4 12.4 C15.6 14.4 14 15.8 12.2 15.8 C10.4 15.9 8.8 14.4 8.8 12.6 C8.8 10.6 10.2 9.4 12 9.4 C13.2 9.4 14.2 9.9 14.8 10.8',
    'image': RECT+'|M4.8 16.4 L9.4 11.6 L13 15.2|M12 14.2 L14.6 11.8 L19.2 16.2|M16.4 8.6 C16.4 9.3 15.8 9.8 15.2 9.8 C14.5 9.8 14 9.2 14 8.6 C14 7.9 14.6 7.4 15.2 7.4',
    'newspaper': 'M16.6 9 V5 H4.6 Q4.2 12 4.4 18.4 Q4.5 20.1 6.2 20 H18.2|M16.6 8.8 H19.6 V18.4 Q19.6 20 18 20 Q16.6 20 16.6 18.4 V8.6|M7.6 8.6 H13.4|M7.6 12 Q10.6 11.8 13.6 12.1|M7.7 15.4 H11.8',
    'bolt': 'M13.5 2.8 L5.6 13.4 H11.7 L10.4 21.2 L18.5 10.4 H12.4 L13.6 3',
    'clock': 'M19.4 10.2 C20.2 14.8 17 19.6 12 19.6 C7.6 19.6 4.4 16.2 4.4 12 C4.4 7.6 7.8 4.4 12 4.4 C14.8 4.4 17.2 5.8 18.4 8|M12 7.8 V12.2 L15.1 14.1',
    'clock-rotate-left': 'M4.6 12 C4.6 16.2 7.8 19.6 12 19.6 C16.2 19.6 19.6 16.2 19.6 12 C19.6 7.8 16.2 4.4 12 4.4 C9.4 4.4 7.2 5.6 5.8 7.6|M5.6 4 L5.6 7.8 L9.4 7.8|M12 8.2 V12.2 L14.8 14',
    'hourglass-half': 'M6.4 3.6 H17.6|M6.4 20.4 H17.6|M7.4 3.8 Q7.2 9 12 12 Q16.8 9 16.6 3.8|M7.4 20.2 Q7.2 15 12 12 Q16.8 15 16.6 20.2|M9.6 18.4 Q12 16.4 14.4 18.4',
    'person-running': RUN,
    'wand-magic-sparkles': 'M4.3 19.9 L15.3 8.9|M13.7 7.2 L17 10.5|M18.6 3.3 Q18.7 5.1 18.6 6.9|M16.8 5.1 H20.4|M7.4 4.4 V7.1|M6.1 5.8 H8.7|M19.4 14.6 h0.1',
    'gem': 'M7.2 4.8 H16.8 L20.4 9.4 L12 20.4 L3.6 9.4 L7.3 4.9|M3.8 9.4 Q12 9.1 20.2 9.5|M9.4 9.4 L12 20 L14.6 9.4|M9.4 9.3 L10.8 4.9|M14.6 9.3 L13.2 4.9',
    'arrow-trend-down': 'M3.5 6.8 L9.4 12.7 L12.8 9.4 L20.2 16.7|M15.6 16.9 L20.4 16.9 L20.3 12.1',
    'arrow-trend-up': 'M3.5 17.2 L9.4 11.3 L12.8 14.6 L20.2 7.3|M15.6 7.1 L20.4 7.1 L20.3 11.9',
    'calculator': 'M6.4 3.4 H17.6 Q19 3.4 19 4.8 V19.2 Q19 20.6 17.6 20.6 H6.4 Q5 20.6 5 19.2 V4.8 Q5 3.4 6.5 3.4|M8 6.4 H16 Q16.2 7.9 16 9.4 H8 Q7.8 7.9 8 6.4|M8.6 13 h0.1|M12 13 h0.1|M15.4 13 h0.1|M8.6 16.6 h0.1|M12 16.6 h0.1|M15.4 16.6 h0.1',
    'sliders': 'M4 7.1 H12.8|M17.2 7 H20|M16.8 7.1 C16.8 8.2 15.9 8.9 15 8.9 C14 8.9 13.2 8.1 13.2 7.1 C13.2 6 14.1 5.2 15.1 5.3|M4 17 H6.8|M11.2 17.1 Q15.6 16.8 20 17|M10.8 17 C10.8 18.1 9.9 18.8 9 18.8 C8 18.8 7.2 18 7.2 17 C7.2 15.9 8.1 15.2 9.1 15.2',
    'chevron-right': 'M9.2 5.4 L15.8 12.1 L9.4 18.6',
    'chevron-left': 'M14.8 5.4 L8.2 12.1 L14.6 18.6',
    'xmark': 'M6 6.2 Q12 12.4 18 17.9|M17.8 6 Q12 11.8 6.1 18',
    'trash-can': 'M4.4 6.8 Q12 6.4 19.6 6.9|M9.6 6.6 V4.6 Q9.6 3.8 10.4 3.8 H13.6 Q14.4 3.8 14.4 4.6 V6.6|M6.4 7 L7.3 19.4 Q7.4 20.4 8.4 20.4 H15.6 Q16.6 20.4 16.7 19.4 L17.6 7|M10.2 10.6 V16.6|M13.8 10.6 V16.6',
    'shield-halved': SHIELD+'|M12 3.8 V20',
    'user-shield': SHIELD+'|M9 12 L11.2 14.2 L15.2 9.8',
    'book': 'M12 6.4 Q8.4 4 4.2 4.6 V18.6 Q8.4 18 12 20.2 Q15.6 18 19.8 18.6 V4.6 Q15.6 4 12 6.4|M12 6.6 V19.8',
    'wallet': 'M4.4 7.4 Q4.4 5.4 6.4 5.4 H17 V8|M4.4 7.4 V17.8 Q4.4 19.6 6.2 19.6 H19.4 V8.2 H6.4 Q4.4 8.2 4.4 7.4|M15.6 13.8 h0.1',
    'seedling': 'M12 20.4 V11.4|M12 12.2 Q12.2 6.4 6 5.8 Q5.4 11.8 12 12.2|M12 14.6 Q12.4 9.6 18.4 9.2 Q18.4 14.6 12 14.6',
    'save': 'M5.6 4.4 H15.6 L19.6 8.4 V18.6 Q19.6 19.6 18.6 19.6 H5.4 Q4.4 19.6 4.4 18.6 V5.4 Q4.4 4.4 5.6 4.4|M8 4.6 V8.6 H14.4 V4.8|M8 19.4 V14 H16 V19.4',
    'gear': 'M10.4 3.6 H13.6 L14.2 6 L16.4 4.8 L18.8 7.2 L17.8 9.6 L20.4 10.4 V13.6 L18 14.2 L19.2 16.6 L16.8 19 L14.4 17.8 L13.6 20.4 H10.4 L9.8 18 L7.4 19.2 L5 16.8 L6.2 14.4 L3.6 13.6 V10.4 L6 9.8 L4.8 7.4 L7.2 5 L9.6 6.2 Z|M14.6 12.4 C14.6 13.8 13.4 14.6 12.2 14.6 C10.8 14.6 9.6 13.6 9.6 12.2 C9.6 10.8 10.6 9.6 12 9.6',
    'sun': 'M15.4 12.2 C15.4 14.2 13.8 15.6 12 15.6 C10 15.6 8.6 14 8.6 12 C8.6 10.2 10.2 8.6 12.1 8.6|M12 3.4 V5.4|M12 18.6 V20.6|M3.4 12 H5.4|M18.6 12 H20.6|M5.9 5.9 L7.3 7.3|M16.7 16.7 L18.1 18.1|M18.1 5.9 L16.7 7.3|M7.3 16.7 L5.9 18.1',
    'moon': 'M19.4 14.6 C18.2 17.6 15.4 19.6 12.2 19.6 C7.8 19.6 4.4 16.2 4.4 11.8 C4.4 8.6 6.4 5.8 9.4 4.6 C8.8 6 8.6 7.2 8.6 8.4 C8.6 12.4 11.6 15.4 15.6 15.4 C17 15.4 18.2 15.1 19.4 14.6',
    'folder-open': 'M4.4 18.6 V6 Q4.4 5 5.4 5 H9.4 L11.2 7 H17.4 Q18.4 7 18.4 8 V10|M4.6 18.6 L7.2 11 Q7.6 10 8.6 10 H20 Q21 10.2 20.6 11.2 L18.2 18 Q17.8 19 16.8 19 H5.2 Q4.4 19 4.6 18.4',
    'rotate': 'M19.4 11 C19 7.2 15.8 4.4 12 4.4 C9.2 4.4 6.8 6 5.6 8.2|M5.4 4.4 L5.5 8.4 L9.4 8.4|M4.6 13 C5 16.8 8.2 19.6 12 19.6 C14.8 19.6 17.2 18 18.4 15.8|M18.6 19.6 L18.5 15.6 L14.6 15.6',
    'rotate-left': 'M4.6 12 C4.6 16.2 8 19.6 12.2 19.6 C16.3 19.6 19.6 16.2 19.6 12 C19.6 7.8 16.2 4.4 12 4.4 C9.6 4.4 7.4 5.4 6 7.2|M5.6 3.6 L5.8 7.6 L9.8 7.4',
    'repeat': 'M4.4 11 V9.4 Q4.4 7 6.8 7 H18.4|M15.6 4.2 L18.6 7 L15.6 9.8|M19.6 13 V14.6 Q19.6 17 17.2 17 H5.6|M8.4 14.2 L5.4 17 L8.4 19.8',
    'trophy': 'M7.6 4.4 H16.4 V9.4 C16.4 12.2 14.4 14.2 12 14.2 C9.6 14.2 7.6 12.2 7.6 9.4 Z|M7.6 6 H4.6 Q4.4 10 7.8 10.6|M16.4 6 H19.4 Q19.6 10 16.2 10.6|M12 14.4 V17.6|M8.4 20 Q8.6 17.6 12 17.6 Q15.4 17.6 15.6 20 Z',
    'medal': 'M8 3.6 L10.6 9|M16 3.6 L13.4 9|M16.4 15.2 C16.4 17.6 14.4 19.6 12 19.6 C9.6 19.6 7.6 17.6 7.6 15.2 C7.6 12.8 9.6 10.8 12 10.8 C13.4 10.8 14.6 11.4 15.4 12.4|M11.2 14.4 L12.2 13.6 V17',
    'table-cells': RECT+'|M4.8 9.6 H19.2|M4.8 14.4 H19.2|M9.6 4.8 V19.2|M14.4 4.8 V19.2',
    'table-list': RECT+'|M4.8 9.6 H19.2|M4.8 14.4 H19.2|M9.4 4.8 V19.2',
    'ruler-combined': 'M4.4 4.4 V19.6 H19.6 V14.6 H9.4 V4.4 Z|M4.6 8.4 H6.6|M4.6 12 H6.6|M13 17.4 V19.4|M16.4 17.4 V19.4',
    'flag-checkered': 'M5.4 20.6 V3.8|M5.6 4.6 Q9 3 12.4 4.8 Q15.6 6.4 19 5 V13.4 Q15.6 14.8 12.4 13.2 Q9 11.4 5.6 13|M5.6 8.8 Q9 7.2 12.4 9 Q15.6 10.6 19 9.2|M12.4 4.8 V13.2',
    'eye': EYE,
    'eye-slash': EYE+'|M4.4 3.8 L19.8 20.2',
    'expand': 'M4.4 9.4 V4.4 H9.4|M14.6 4.4 H19.6 V9.4|M19.6 14.6 V19.6 H14.6|M9.4 19.6 H4.4 V14.6',
    'compress': 'M9.4 4.4 V9.4 H4.4|M19.6 9.4 H14.6 V4.4|M14.6 19.6 V14.6 H19.6|M4.4 14.6 H9.4 V19.6',
    'earth-asia': CIRC+'|M5 9.4 Q8.4 9 9.4 11.4 Q10 13.6 8.4 15.6|M13.6 4.8 Q13 7.6 15.4 8.4 Q17.8 9 19.2 8.2|M14 19.2 Q14.4 16 17 15 Q18.6 14.6 19.4 13.4',
    'coins': 'M14.6 7.2 C14.6 8.6 12.2 9.6 9.4 9.6 C6.6 9.6 4.4 8.6 4.4 7.2 C4.4 5.8 6.6 4.6 9.4 4.6 C12.2 4.6 14.6 5.8 14.6 7.2|M4.4 7.4 V11.6 C4.4 13 6.6 14 9.4 14|M4.4 11.8 V16 C4.4 17.4 6.6 18.4 9.4 18.4|M19.6 12.4 C19.6 13.8 17.4 14.8 14.6 14.8 C11.8 14.8 9.6 13.8 9.6 12.4 C9.6 11 11.8 10 14.6 10 C17.4 10 19.6 11 19.6 12.4|M9.6 12.6 V16.8 C9.6 18.2 11.8 19.4 14.6 19.4 C17.4 19.4 19.6 18.2 19.6 16.8 V12.4',
    'arrows-up-down': 'M8 4.4 V19.6|M5.2 7.2 L8 4.4 L10.8 7.2|M16 19.6 V4.4|M13.2 16.8 L16 19.6 L18.8 16.8',
    'thumbs-up': THUMB,
    'thumbs-down': [THUMB, 'rotate(180 12 12)'],
    'tags': 'M4.4 4.4 H11 L19.4 12.8 L12.8 19.4 L4.4 11 Z|M8.4 8.4 h0.1',
    'skull': 'M12 3.8 C16.4 3.8 19.4 7 19.2 11 C19 13.4 17.6 14.8 16.4 15.4 V19 H7.6 V15.4 C6.4 14.8 5 13.4 4.8 11 C4.6 7 7.6 3.8 12 3.8|M10.6 11.4 C10.6 12.2 10 12.8 9.4 12.8 C8.7 12.8 8.2 12.2 8.2 11.4 C8.2 10.7 8.8 10.2 9.4 10.2 C10 10.2 10.6 10.7 10.6 11.4|M15.8 11.4 C15.8 12.2 15.2 12.8 14.6 12.8 C13.9 12.8 13.4 12.2 13.4 11.4 C13.4 10.7 14 10.2 14.6 10.2 C15.2 10.2 15.8 10.7 15.8 11.4|M10.4 19 V16.8|M13.6 19 V16.8',
    'shoe-prints': 'M8 3.8 C9.8 3.8 10.6 5.8 10.4 8.2 C10.2 10.2 9.4 11.4 8 11.4 C6.6 11.4 5.8 10.2 5.6 8.2 C5.4 5.8 6.2 3.8 8 3.8|M6.2 13.6 H9.8 V15.2 Q9.8 16.8 8 16.8 Q6.2 16.8 6.2 15.2 Z|M16 7.4 C17.8 7.4 18.6 9.4 18.4 11.8 C18.2 13.8 17.4 15 16 15 C14.6 15 13.8 13.8 13.6 11.8 C13.4 9.4 14.2 7.4 16 7.4|M14.2 17.2 H17.8 V18.8 Q17.8 20.4 16 20.4 Q14.2 20.4 14.2 18.8 Z',
    'scissors': 'M8.6 6.4 C8.6 7.8 7.6 8.8 6.4 8.8 C5.2 8.8 4.2 7.8 4.2 6.6 C4.2 5.4 5.2 4.4 6.4 4.4 C7.6 4.4 8.6 5.2 8.6 6.4|M8.6 17.6 C8.6 18.8 7.6 19.8 6.4 19.8 C5.2 19.8 4.2 18.8 4.2 17.6 C4.2 16.4 5.2 15.4 6.4 15.4 C7.6 15.4 8.6 16.4 8.6 17.6|M8.2 8 L19.6 17.6|M8.2 16 L19.6 6.4',
    'scale-balanced': 'M12 4 V19.6|M7.6 19.8 H16.4|M4.6 7 Q12 5.4 19.4 7|M4.6 7 L2.8 12.4 Q4.6 14 6.4 12.4 L4.6 7|M19.4 7 L17.6 12.4 Q19.4 14 21.2 12.4 L19.4 7',
    'scale-unbalanced': 'M12 4 V19.6|M7.6 19.8 H16.4|M4.6 9 Q12 5.6 19.4 5|M4.6 9 L2.8 14.4 Q4.6 16 6.4 14.4 L4.6 9|M19.4 5 L17.6 10.4 Q19.4 12 21.2 10.4 L19.4 5',
    'r': 'M7.6 19.6 V4.6 H13 Q17 4.6 17 8.4 Q17 12.2 13 12.2 H7.8|M12.4 12.4 L17.4 19.6',
    'note-sticky': 'M4.6 5.6 Q4.5 4.5 5.6 4.6 H18.4 Q19.5 4.5 19.4 5.6 V13.6 L13.6 19.4 H5.6 Q4.5 19.5 4.6 18.4 Z|M19.2 13.6 H14.6 Q13.6 13.6 13.6 14.6 V19.2',
    'mobile-screen': 'M7.4 3.4 H16.6 Q17.8 3.4 17.8 4.6 V19.4 Q17.8 20.6 16.6 20.6 H7.4 Q6.2 20.6 6.2 19.4 V4.6 Q6.2 3.4 7.4 3.4|M10.6 17.6 H13.4',
    'magnifying-glass': 'M16.6 10.4 C16.8 14 14 16.6 10.6 16.6 C7.2 16.6 4.4 14 4.4 10.4 C4.4 7 7.2 4.4 10.6 4.4 C12.8 4.4 14.6 5.4 15.6 7.2|M15.2 15.2 L20 20',
    'magnifying-glass-chart': 'M16.6 10.4 C16.8 14 14 16.6 10.6 16.6 C7.2 16.6 4.4 14 4.4 10.4 C4.4 7 7.2 4.4 10.6 4.4 C12.8 4.4 14.6 5.4 15.6 7.2|M15.2 15.2 L20 20|M7.8 12.4 L9.8 10.2 L11.4 11.6 L13.4 8.8',
    'list-check': 'M10 6.4 H20|M10 12 Q15 11.7 20 12.1|M10 17.6 H20|M3.8 6.4 L5.2 7.8 L7.6 5|M3.8 12.2 L5.2 13.6 L7.6 10.8|M4.6 17.6 h0.1',
    'list': 'M9 6.4 H20|M9 12 Q14.5 11.7 20 12.1|M9 17.6 H20|M4.6 6.4 h0.1|M4.6 12 h0.1|M4.6 17.6 h0.1',
    'link': 'M10.2 13.8 Q8 11.6 10 9.4 L12.8 6.6 Q15 4.4 17.2 6.6 Q19.4 8.8 17.2 11 L15.8 12.4|M13.8 10.2 Q16 12.4 14 14.6 L11.2 17.4 Q9 19.6 6.8 17.4 Q4.6 15.2 6.8 13 L8.2 11.6',
    'layer-group': 'M12 4 L20.2 8.2 L12 12.4 L3.8 8.2 Z|M3.8 12.2 L12 16.4 L20.2 12.2|M3.8 16 L12 20.2 L20.2 16',
    'inbox': 'M4.4 13 L6.8 5.6 Q7.2 4.6 8.2 4.6 H15.8 Q16.8 4.6 17.2 5.6 L19.6 13 V18.4 Q19.6 19.6 18.4 19.6 H5.6 Q4.4 19.6 4.4 18.4 Z|M4.6 13 H8.6 L9.6 15.4 H14.4 L15.4 13 H19.4',
    'gavel': 'M9.4 7 L13 3.4 L20.6 11 L17 14.6 Z|M11.2 12.4 L4.6 19 Q4 19.8 4.8 20.2 Q5.4 20.4 5.8 19.8 L12.4 13.6|M13.6 20.4 H20.4',
    'envelope': 'M4.4 6.6 Q4.4 5.4 5.6 5.4 H18.4 Q19.6 5.4 19.6 6.6 V17.4 Q19.6 18.6 18.4 18.6 H5.6 Q4.4 18.6 4.4 17.4 Z|M4.8 6.6 L12 12.4 L19.2 6.6',
    'door-open': 'M5.4 20.2 H18.6|M7.4 20 V4.6 H16.6 V20|M7.6 4.8 L13 6.4 V20|M10.8 12.4 h0.1',
    'brain': 'M12 5.4 C10.6 3.8 7.6 4.4 7.4 6.8 C5.2 7 4.4 9.6 5.6 11 C4 12.4 4.6 15.4 6.8 15.6 C6.8 18 9.6 19.4 12 17.8 C14.4 19.4 17.2 18 17.2 15.6 C19.4 15.4 20 12.4 18.4 11 C19.6 9.6 18.8 7 16.6 6.8 C16.4 4.4 13.4 3.8 12 5.4|M12 5.6 V17.6|M9 9.6 Q10.4 10.2 10.2 11.8|M15 9.6 Q13.6 10.2 13.8 11.8',
    'bell': 'M6.4 16.6 V11 C6.4 7.6 8.8 5.2 12 5.2 C15.2 5.2 17.6 7.6 17.6 11 V16.6 L19 18 H5 Z|M10.2 20 Q12 21.4 13.8 20|M12 3.4 V5',
    'arrow-up-right-from-square': 'M10.6 5.4 H6 Q4.6 5.4 4.6 6.8 V18 Q4.6 19.4 6 19.4 H17.2 Q18.6 19.4 18.6 18 V13.4|M13.4 4.4 H19.6 V10.6|M19.4 4.6 L11 13',
    'arrow-up-right': 'M6.4 17.6 L17.4 6.6|M9.4 6.4 H17.6 V14.6',
    'arrow-down-left': 'M17.6 6.4 L6.6 17.4|M6.4 9.4 V17.6 H14.6',
    'arrow-up': 'M12 19.6 V4.6|M6.4 10 L12 4.4 L17.6 10',
    'arrow-down': 'M12 4.4 V19.4|M6.4 14 L12 19.6 L17.6 14',
    'arrow-right': 'M4.4 12 H19.4|M14 6.4 L19.6 12 L14 17.6',
    'arrow-right-from-bracket': 'M9.6 4.4 H5.6 Q4.4 4.4 4.4 5.6 V18.4 Q4.4 19.6 5.6 19.6 H9.6|M9.4 12 H19.6|M15.4 7.6 L19.8 12 L15.4 16.4'
  };
  const ALIAS = { 'chart-area':'chart-line', 'fire-flame-curved':'fire', 'trash':'trash-can', 'floppy-disk':'save', 'calendar-days':'calendar',
    'person-walking-arrow-right':'person-running', 'location-crosshairs':'crosshairs', 'file-export':'file-arrow-up', 'file':'file-lines' };
  const SKIP = /\b(fa-spin|fa-pulse|fa-brands|fa-spinner|fa-circle-notch)\b/;

  const root = document.documentElement;
  const LS = { get(k,d){ try{ const v = localStorage.getItem(k); return v==null ? d : v; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } };
  let enabled = LS.get('tj_icon_style','hand') !== 'std';

  function nameOf(i){
    const cls = (i.getAttribute('class')||'').split(/\s+/);
    for(const c of cls){ if(c.slice(0,3)!=='fa-') continue; const n = ALIAS[c.slice(3)] || c.slice(3); if(P[n]) return n; }
    return null;
  }
  function svgFor(n, keep){
    const e = P[n]; const d = Array.isArray(e) ? e[0] : e; const t = Array.isArray(e) ? ' transform="'+e[1]+'"' : '';
    return '<svg class="tj-hi'+(keep?' keep':'')+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g'+t+'>'
      + d.split('|').map(p=>'<path d="'+p+'"/>').join('') + '</g></svg>';
  }
  function unpaint(i){
    if(!i.classList.contains('tj-hd')) return;
    const s = i.querySelector(':scope > svg.tj-hi'); if(s) s.remove();
    i.classList.remove('tj-hd'); delete i.dataset.hi;
  }
  function paint(i){
    if(i.tagName !== 'I') return;
    const cls = i.getAttribute('class') || '';
    if(cls.indexOf('fa-') < 0) return;
    if(!enabled || SKIP.test(cls)){ unpaint(i); return; }
    const n = nameOf(i);
    if(!n){ unpaint(i); return; }
    if(i.dataset.hi === n && i.classList.contains('tj-hd') && i.querySelector(':scope > svg.tj-hi')) return;
    // ไอคอนที่กำหนดสีเฉพาะไว้ (สีขาวบนปุ่มเข้ม, สีกำไร/ขาดทุน) ให้คงสีเดิม ไม่ใช้สีที่ผู้ใช้เลือก
    const keep = !!(i.style && i.style.color) || /\btext-(?!dark|muted|secondary|body)\w/.test(cls);
    i.dataset.hi = n;
    if(!i.classList.contains('tj-hd')) i.classList.add('tj-hd');
    i.innerHTML = svgFor(n, keep);
  }
  function scan(node){
    if(!node || node.nodeType !== 1) return;
    if(node.tagName === 'I') paint(node);
    if(node.firstElementChild) node.querySelectorAll('i[class*="fa-"]').forEach(paint);
  }
  const mo = new MutationObserver(recs=>{
    for(const r of recs){
      if(r.type === 'attributes'){ if(r.target.tagName === 'I') paint(r.target); }
      else r.addedNodes.forEach(scan);
    }
  });
  mo.observe(root, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  document.addEventListener('DOMContentLoaded', ()=>scan(document.body));

  // ── สีไอคอน ──
  function applyColor(){
    const c = LS.get('tj_icon_color','auto');
    const custom = enabled && /^#[0-9a-f]{6}$/i.test(c);
    root.classList.toggle('tj-icon-custom', custom);
    if(custom) root.style.setProperty('--tj-icon-user', c); else root.style.removeProperty('--tj-icon-user');
  }
  applyColor();

  // ── หน้าตั้งค่า ──
  function syncUI(){
    const box = document.getElementById('tj-icon-settings'); if(!box) return;
    const c = LS.get('tj_icon_color','auto').toLowerCase();
    box.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('active', (b.dataset.s==='hand') === enabled));
    let matched = false;
    box.querySelectorAll('[data-c]').forEach(b=>{ const on = b.dataset.c.toLowerCase() === c; if(on) matched = true; b.classList.toggle('active', on); });
    const cu = box.querySelector('.tj-icon-custom-btn'); const inp = box.querySelector('input[type=color]');
    if(cu) cu.classList.toggle('active', !matched && c !== 'auto');
    if(inp && /^#[0-9a-f]{6}$/i.test(c)) inp.value = c;
    box.classList.toggle('tj-icons-off', !enabled);
  }
  function setStyle(s){
    enabled = s !== 'std'; LS.set('tj_icon_style', enabled ? 'hand' : 'std');
    document.querySelectorAll('i[class*="fa-"]').forEach(paint);
    applyColor(); syncUI();
  }
  function setColor(c){ LS.set('tj_icon_color', c); applyColor(); syncUI(); }
  document.addEventListener('click', e=>{
    const box = e.target.closest && e.target.closest('#tj-icon-settings'); if(!box) return;
    const s = e.target.closest('[data-s]'); if(s){ setStyle(s.dataset.s); return; }
    const c = e.target.closest('[data-c]'); if(c){ setColor(c.dataset.c); return; }
  });
  document.addEventListener('input', e=>{ if(e.target && e.target.id === 'tj-icon-color-input') setColor(e.target.value); });
  document.addEventListener('DOMContentLoaded', syncUI);
  window.tjHandIcons = { setStyle, setColor, refresh: ()=>scan(document.body) };
})();
