import fs from 'fs';
const podiumCss = `
/* ============================================================
   PODIUM
   ============================================================ */
.podium-container {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 10px;
  margin-top: 40px;
  margin-bottom: 40px;
  min-height: 350px;
}

.podium-place {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 180px;
}

.podium-place.rank-1 {
  z-index: 3;
}

.podium-place.rank-2 {
  z-index: 2;
}

.podium-place.rank-3 {
  z-index: 1;
}

/* Stickman */
.stickman {
  position: relative;
  width: 60px;
  height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: -5px; /* connect to podium */
}

.stickman-head {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 4px solid #111;
  box-shadow: 4px 4px 0 #111;
  background-color: #fff;
  overflow: hidden;
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stickman-head img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.stickman-head .placeholder {
  font-size: 2rem;
  color: #aaa;
}

.stickman-body {
  width: 6px;
  height: 40px;
  background-color: #111;
  position: relative;
  z-index: 1;
}

.stickman-arms {
  position: absolute;
  top: 75px; /* below head */
  width: 60px;
  height: 6px;
  background-color: #111;
  z-index: 1;
  transform: rotate(-10deg);
}

.rank-2 .stickman-arms { transform: rotate(10deg); }
.rank-3 .stickman-arms { transform: rotate(5deg); }

.stickman-legs {
  position: absolute;
  bottom: 0;
  width: 50px;
  height: 30px;
  z-index: 1;
}

.stickman-leg {
  position: absolute;
  top: 0;
  width: 6px;
  height: 35px;
  background-color: #111;
}

.stickman-leg.left {
  left: 15px;
  transform: rotate(30deg);
  transform-origin: top center;
}

.stickman-leg.right {
  right: 15px;
  transform: rotate(-30deg);
  transform-origin: top center;
}

/* Podium Blocks */
.podium-block {
  width: 100%;
  border: 5px solid #111;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 10px;
  text-align: center;
  position: relative;
}

.podium-block::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: -5px;
  right: -5px;
  height: 5px;
  background: #111;
}

.rank-1 .podium-block {
  height: 180px;
  background-color: #c4f053; /* vibrant green-yellow */
  box-shadow: inset -5px -5px 0 rgba(0,0,0,0.1);
}

.rank-2 .podium-block {
  height: 130px;
  background-color: #f8f0e3;
  box-shadow: inset -5px -5px 0 rgba(0,0,0,0.1);
}

.rank-3 .podium-block {
  height: 100px;
  background-color: #ffe4e1;
  box-shadow: inset -5px -5px 0 rgba(0,0,0,0.1);
}

.podium-rank-number {
  font-size: 4rem;
  line-height: 1;
  color: #111;
  margin-bottom: 5px;
  text-shadow: 2px 2px 0 rgba(255,255,255,0.5);
}

.podium-name {
  font-size: 1.4rem;
  color: #111;
  line-height: 1.1;
  margin-bottom: 5px;
  word-break: break-word;
}

.podium-score {
  font-size: 1.1rem;
  color: #555;
}

/* Responsive Podium */
@media (max-width: 600px) {
  .podium-container {
    flex-direction: column;
    align-items: center;
    gap: 20px;
    min-height: auto;
  }
  .podium-place {
    width: 100%;
    max-width: 250px;
  }
  .podium-block {
    height: auto !important;
    padding-bottom: 20px;
    border-bottom: 5px solid #111;
  }
  .podium-block::after {
    display: none;
  }
}
`;
fs.appendFileSync('c:/justbuild2026/client/src/index.css', podiumCss);
console.log('Appended podium CSS');
