
const importMap = {
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "react/": "https://esm.sh/react@18.2.0/",
    "react-dom": "https://esm.sh/react-dom@18.2.0",
    "react-dom/": "https://esm.sh/react-dom@18.2.0/",
    "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
    "three": "https://esm.sh/three@0.180.0",
    "three/": "https://esm.sh/three@0.180.0/",
    "framer-motion": "https://esm.sh/framer-motion@12.23.24",
    "gsap": "https://esm.sh/gsap@3.13.0",
    "@phosphor-icons/react": "https://esm.sh/@phosphor-icons/react@2.1.0",
    "uuid": "https://esm.sh/uuid@9.0.1",
    "js-yaml": "https://esm.sh/js-yaml@4.1.0",
    "jszip": "https://esm.sh/jszip@3.10.1",
    "webm-muxer": "https://esm.sh/webm-muxer@5.0.2",
    "cannon-es": "https://esm.sh/cannon-es@0.20.0"
  }
};

const im = document.createElement('script');
im.type = 'importmap';
im.textContent = JSON.stringify(importMap);
document.currentScript.after(im);
