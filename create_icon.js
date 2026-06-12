const fs = require('fs');

const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="110" fill="#2196F3"/>
    <path d="M128 96H320C355.346 96 384 124.654 384 160V384C384 419.346 355.346 448 320 448H128C101.49 448 80 426.51 80 400V144C80 117.49 101.49 96 128 96Z" fill="white"/>
    <path d="M128 96H300V448H128C101.49 448 80 426.51 80 400V144C80 117.49 101.49 96 128 96Z" fill="#E3F2FD"/>
    <rect x="144" y="160" width="160" height="20" rx="10" fill="#BBDEFB"/>
    <rect x="144" y="220" width="160" height="20" rx="10" fill="#BBDEFB"/>
    <rect x="144" y="280" width="100" height="20" rx="10" fill="#BBDEFB"/>
    <circle cx="380" cy="380" r="100" fill="#4CAF50" stroke="#2196F3" stroke-width="12"/>
    <path d="M330 380L365 410L430 345" stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

fs.writeFileSync('icon.svg', svgIcon);
console.log('Icon SVG created');
