import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Play, Settings, Image as ImageIcon, Video, FileText, Copy, Check, Upload, X, Download, RefreshCw, Save, ChevronDown, ChevronUp, BookOpen, Sparkles, Wand2, Phone } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const TOPICS = [
  "Động vật", "Động vật nông trại", "Động vật hoang dã", "Động vật biển", "Các loài chim",
  "Côn trùng", "Trái cây", "Rau củ", "Đồ ăn", "Đồ uống", "Bữa sáng", "Bánh kẹo",
  "Đồ dùng nhà bếp", "Đồ vật trong nhà", "Đồ vật phòng khách", "Đồ vật phòng ngủ",
  "Đồ vật phòng tắm", "Quần áo", "Giày dép", "Thời tiết", "Các mùa", "Màu sắc",
  "Con số", "Hình dạng", "Bộ phận cơ thể", "Bộ phận khuôn mặt", "Thành viên gia đình",
  "Đồ dùng học tập", "Đồ vật lớp học", "Đồ chơi", "Phương tiện giao thông", "Xe cộ",
  "Nghề nghiệp", "Thể thao", "Nhạc cụ", "Hoạt động hàng ngày", "Thói quen buổi sáng",
  "Thói quen buổi tối", "Cảm xúc", "Tính từ", "Từ trái nghĩa", "Thiên nhiên", "Rừng",
  "Đại dương", "Công viên", "Sở thú", "Bãi biển", "Không gian vũ trụ",
  "Sinh vật tưởng tượng", "Khủng long", "Robot"
];

const SCENE_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const CHARACTER_PAIRS = [
  { id: "Father and Son", label: "Cha và Con trai" },
  { id: "Father and Daughter", label: "Cha và Con gái" },
  { id: "Mother and Son", label: "Mẹ và Con trai" },
  { id: "Mother and Daughter", label: "Mẹ và Con gái" }
];

const CLOTHING_MODES = [
  { id: "Automatic clothing", label: "Trang phục Phù hợp bối cảnh" },
  { id: "Fixed clothing", label: "Trang phục cố định" }

];

const AUTO_IMAGE_OPTIONS = [
  { id: "YES", label: "KHÔNG" },
  { id: "NO", label: "CÓ" }
];

const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16 (Dọc)" },
  { id: "16:9", label: "16:9 (Ngang)" },
  { id: "1:1", label: "1:1 (Vuông)" }
];

const CTA_OPTIONS = [
  { id: "NONE", label: "KHÔNG CTA" },
  { id: "AUTO", label: "CTA TỰ ĐỘNG" },
  { id: "CUSTOM", label: "CTA TÙY CHỈNH" }
];

export default function App() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [numScenes, setNumScenes] = useState(1);
  const [characterPair, setCharacterPair] = useState(CHARACTER_PAIRS[0].id);
  const [childName, setChildName] = useState('');
  const [clothingMode, setClothingMode] = useState(CLOTHING_MODES[0].id);
  const [autoGenerateImages, setAutoGenerateImages] = useState(AUTO_IMAGE_OPTIONS[0].id);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0].id);
  const [ctaMode, setCtaMode] = useState(CTA_OPTIONS[0].id);
  const [customCtaText, setCustomCtaText] = useState('');
  const [parentImage, setParentImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [childImage, setChildImage] = useState<{ data: string, mimeType: string } | null>(null);
  
  const [showGuide, setShowGuide] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedVideo, setCopiedVideo] = useState(false);
  const [copiedVocab, setCopiedVocab] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({});
  const [generatingImages, setGeneratingImages] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setImage: (img: { data: string, mimeType: string } | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setImage({ data: base64String, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    } else {
      setImage(null);
    }
  };

  const copySection = (sectionName: string, setCopied: (v: boolean) => void) => {
    if (!result) return;
    const parts = result.split(/(?=Từ vựng trong video|SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/);
    const section = parts.find(p => p.trim().startsWith(sectionName));
    if (section) {
      const textToCopy = section.replace(sectionName, '').trim();
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyVocabulary = () => {
    if (!result) return;
    const parts = result.split(/(?=Từ vựng trong video|SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/);
    const section = parts.find(p => p.trim().startsWith('Từ vựng trong video'));
    if (section) {
      const lines = section.split('\n').map(l => l.trim()).filter(l => l);
      let vocabList = [];
      let currentVocab = { vi: '', en: '', ipa: '' };
      
      for (const line of lines) {
        if (line.startsWith('Từ tiếng Việt:')) {
          if (currentVocab.vi) vocabList.push({...currentVocab});
          currentVocab = { vi: line.replace('Từ tiếng Việt:', '').trim(), en: '', ipa: '' };
        } else if (line.startsWith('Tiếng Anh:')) {
          currentVocab.en = line.replace('Tiếng Anh:', '').trim();
        } else if (line.startsWith('Phiên âm:')) {
          currentVocab.ipa = line.replace('Phiên âm:', '').trim();
        }
      }
      if (currentVocab.vi) vocabList.push({...currentVocab});
      
      const textToCopy = vocabList.map(v => `${v.vi} - ${v.en} - ${v.ipa}`).join('\n');
      navigator.clipboard.writeText(textToCopy);
      setCopiedVocab(true);
      setTimeout(() => setCopiedVocab(false), 2000);
    }
  };

  const extractImagePrompts = (text: string) => {
    const parts = text.split(/(?=Từ vựng trong video|SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/);
    const imageSection = parts.find(p => p.trim().startsWith('IMAGE PROMPTS'));
    if (!imageSection) return [];
    
    const lines = imageSection.replace('IMAGE PROMPTS', '').trim().split('\n').filter(l => l.trim() !== '' && l.trim().startsWith('Scene'));
    return lines;
  };

  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s+/g, '');
  };

  const handleDownloadImage = (index: number, dataUrl: string) => {
    const cleanTopic = removeAccents(topic);
    const sceneId = (index + 1).toString().padStart(2, '0');
    const filename = `${cleanTopic}_${sceneId}.png`;
    
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllImages = () => {
    Object.entries(generatedImages).forEach(([indexStr, dataUrl]) => {
      const index = parseInt(indexStr, 10);
      handleDownloadImage(index, dataUrl);
    });
  };

  const handleDownloadAllData = async () => {
    if (!result) return;
    
    const zip = new JSZip();
    const cleanTopic = removeAccents(topic);
    const rootFolder = zip.folder(cleanTopic);
    if (!rootFolder) return;
    
    const parts = result.split(/(?=Từ vựng trong video|SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/);
    
    const vocabSection = parts.find(p => p.trim().startsWith('Từ vựng trong video'));
    if (vocabSection) {
      rootFolder.file('VOCABULARY.txt', vocabSection.replace('Từ vựng trong video', '').trim());
    }
    
    const imagePromptSection = parts.find(p => p.trim().startsWith('IMAGE PROMPTS'));
    if (imagePromptSection) {
      rootFolder.file('image_prompt.txt', imagePromptSection.replace('IMAGE PROMPTS', '').trim());
    }
    
    const videoPromptSection = parts.find(p => p.trim().startsWith('VIDEO PROMPTS'));
    if (videoPromptSection) {
      rootFolder.file('video_prompt.txt', videoPromptSection.replace('VIDEO PROMPTS', '').trim());
    }
    
    const scriptSection = parts.find(p => p.trim().startsWith('SCENE SCRIPTS'));
    if (scriptSection) {
      rootFolder.file('SCENE_SCRIPTS.txt', scriptSection.replace('SCENE SCRIPTS', '').trim());
    }
    
    const imageKeys = Object.keys(generatedImages);
    if (imageKeys.length > 0) {
      const imagesFolder = rootFolder.folder('images');
      if (imagesFolder) {
        imageKeys.forEach(indexStr => {
          const index = parseInt(indexStr, 10);
          const dataUrl = generatedImages[index];
          const base64Data = dataUrl.split(',')[1];
          const sceneId = (index + 1).toString().padStart(2, '0');
          imagesFolder.file(`scene_${sceneId}.png`, base64Data, { base64: true });
        });
      }
    }
    
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${cleanTopic}.zip`);
  };

  const generateSingleImage = async (index: number, promptText: string) => {
    setGeneratingImages(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const parts: any[] = [];
      
      if (parentImage) {
        parts.push({ inlineData: { data: parentImage.data, mimeType: parentImage.mimeType } });
      }
      if (childImage) {
        parts.push({ inlineData: { data: childImage.data, mimeType: childImage.mimeType } });
      }
      parts.push({ text: promptText });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });
      
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          setGeneratedImages(prev => ({
            ...prev,
            [index]: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
          }));
          break;
        }
      }
    } catch (err) {
      console.error(`Error generating image for scene ${index + 1}:`, err);
    } finally {
      setGeneratingImages(false);
    }
  };

  const generateImages = async (promptsToUse?: string[]) => {
    const prompts = promptsToUse || extractImagePrompts(result);
    if (prompts.length === 0) return;
    
    setGeneratingImages(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const newImages = { ...generatedImages };
      
      for (let i = 0; i < prompts.length; i++) {
        const promptText = prompts[i];
        
        const parts: any[] = [];
        
        if (parentImage) {
          parts.push({ inlineData: { data: parentImage.data, mimeType: parentImage.mimeType } });
        }
        if (childImage) {
          parts.push({ inlineData: { data: childImage.data, mimeType: childImage.mimeType } });
        }
        
        parts.push({ text: promptText });
        
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio: aspectRatio
              }
            }
          });
          
          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
              newImages[i] = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              setGeneratedImages({ ...newImages });
              break;
            }
          }
        } catch (err) {
          console.error(`Error generating image for scene ${i + 1}:`, err);
        }
      }
    } catch (error) {
      console.error("Error generating images:", error);
    } finally {
      setGeneratingImages(false);
    }
  };

  const generateContent = async () => {
    setLoading(true);
    setResult('');
    setGeneratedImages({});
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let parentRole = characterPair.includes("Father") ? "Father" : "Mother";
      let childRole = characterPair.includes("Son") ? "Son" : "Daughter";
      
      let defaultChildName = childRole === "Son" ? "con trai" : "con gái";
      let actualChildName = childName.trim() !== "" ? childName.trim() : defaultChildName;
      
      let parentVietnamese = parentRole === "Father" ? "Cha" : "Mẹ";
      
      const promptText = `You are an AI product designer and prompt engineer.
Generate content for short animated educational videos where a Vietnamese ${parentRole.toLowerCase()} teaches their young ${childRole.toLowerCase()} English vocabulary.

Topic: ${topic}
Number of scenes: ${numScenes}

CHARACTER SYSTEM
Character Pair: ${characterPair}
Child's Name: ${actualChildName}
Parent Role in Vietnamese: ${parentVietnamese}

If reference images are provided (attached to this prompt), you MUST:
1. Analyze the reference images.
2. Describe the character appearance (hair style, hair color, face shape, skin tone, age appearance, facial features, general body type).
3. Use that exact appearance description consistently in all IMAGE PROMPTS and VIDEO PROMPTS.

If no reference images are provided, use this DEFAULT CHARACTER STYLE:
Vietnamese ${parentRole.toLowerCase()} around 30 years old, Vietnamese ${childRole.toLowerCase()} around 5 years old.
Style: cute animated Pixar style, friendly facial expressions, round soft facial features.

CLOTHING MODE: ${clothingMode}
If "Fixed clothing": The clothing remains the exact same in all scenes (e.g., ${parentRole.toLowerCase()} wearing blue shirt and jeans, ${childRole.toLowerCase()} wearing yellow T-shirt and shorts).
If "Automatic clothing": Clothing automatically adapts to the scene environment (e.g., kitchen -> casual home clothes, park -> outdoor casual clothes).

APP PURPOSE
The application generates short learning scenes where a ${parentRole.toLowerCase()} teaches English words to their ${childRole.toLowerCase()} by pointing at animals or objects that appear clearly in front of them.
The ${parentRole.toLowerCase()} asks questions in Vietnamese.
The ${childRole.toLowerCase()} answers with the English word.
All scripts must be written in Vietnamese.
All prompts must be written in English.

${ctaMode !== 'NONE' ? `
FINAL CTA SCENE (MANDATORY)
After the ${numScenes} learning scenes, you MUST add exactly ONE final CTA scene.
Rules for the CTA scene:
1. Only the ${childRole.toLowerCase()} appears. The ${parentRole.toLowerCase()} does NOT appear.
2. The ${childRole.toLowerCase()} stands alone facing the camera.
3. The ${childRole.toLowerCase()} speaks directly to the audience.
4. Dialogue: "${ctaMode === 'AUTO' ? "Bạn nhớ follow kênh để học tiếng Anh cùng mình mỗi ngày nhé!" : (customCtaText.trim() || "Hãy follow kênh để học tiếng Anh mỗi ngày")}"
5. Style: same 3D Pixar style.

For this CTA scene, you must generate:
- One script line in SCENE SCRIPTS section.
- One IMAGE PROMPT in IMAGE PROMPTS section.
- One VIDEO PROMPT in VIDEO PROMPTS section.

Example CTA script:
Scene ${numScenes + 1} – Con nói: "${ctaMode === 'AUTO' ? "Bạn nhớ follow kênh để học tiếng Anh cùng mình mỗi ngày nhé!" : (customCtaText.trim() || "Hãy follow kênh để học tiếng Anh mỗi ngày")}"

Example CTA Image Prompt:
Scene ${numScenes + 1} – front camera view, a cute cheerful Vietnamese child standing alone facing the camera in a bright colorful park, smiling and waving to the audience, 3D Pixar animated style, cinematic lighting, vibrant colors, family friendly, educational.

Example CTA Video Prompt:
Scene ${numScenes + 1} – front camera angle, a cute Vietnamese child standing alone facing the camera in a colorful park, smiling and speaking happily to the audience inviting them to follow the channel, 3D Pixar animation style, cinematic lighting, cheerful and friendly atmosphere.
` : ''}

VIDEO STYLE
All scenes must follow this visual style:
High-quality 3D animated film style inspired by modern Western animated cinema, soft rounded and friendly character designs, slightly exaggerated facial expressions for emotional clarity, clean and smooth surfaces, richly detailed yet whimsical environments, cinematic lighting with warm golden-hour tones, soft shadows and gentle depth of field, non-photorealistic, stylized realism, emotionally expressive, heartwarming tone, professional studio-quality animation, no text overlays. quality 4K

VERY IMPORTANT CAMERA RULE
The camera must always face the characters from the FRONT.
Both ${parentRole.toLowerCase()} and ${childRole.toLowerCase()} must always stand next to each other and face the camera.
The animal or object must also appear in the SAME FRAME close to them.
The ${parentRole.toLowerCase()} must be able to POINT at the object or animal.
The object must NOT be far away.
Everything must appear clearly in one frame.

SCENE STRUCTURE
Each scene must contain:
a clear environment
a visible animal or object
${parentRole.toLowerCase()} pointing at it
${childRole.toLowerCase()} looking at it
The animal or object must be close to them inside the same frame.

Each scene must contain EXACTLY:
${parentRole} question 1
${childRole} answer
${parentRole} question 2
${childRole} answer

OUTPUT FORMAT
The output must contain exactly four sections formatted exactly like the example below. Do not use Markdown headings like "#", just use the exact text for section headers.

Từ vựng trong video
Extract the vocabulary words that the parent asks the child in the scenes.
For each vocabulary word, display three fields:
Từ tiếng Việt: [Vietnamese word]
Tiếng Anh: [English word]
Phiên âm: [IPA pronunciation]

Example:
Từ tiếng Việt: con mèo
Tiếng Anh: Cat
Phiên âm: /kæt/

SCENE SCRIPTS
Must be written in Vietnamese. Each scene script must be on a single paragraph.
Example dialogue format:
${parentVietnamese} hỏi: "${actualChildName} ơi, con mèo tiếng Anh là gì?"
Con trả lời: "Cat!"

IMAGE PROMPTS
All prompts must be written in English.
Each prompt must include: character descriptions, character clothing, reference appearance if provided, front camera view, ${parentRole.toLowerCase()} and ${childRole.toLowerCase()} standing side by side, animal or object close to them, ${parentRole.toLowerCase()} pointing at object, ${childRole.toLowerCase()} looking at object.
Each prompt MUST include this exact style description at the end: "High-quality 3D animated film style inspired by modern Western animated cinema, soft rounded and friendly character designs, slightly exaggerated facial expressions for emotional clarity, clean and smooth surfaces, richly detailed yet whimsical environments, cinematic lighting with warm golden-hour tones, soft shadows and gentle depth of field, non-photorealistic, stylized realism, emotionally expressive, heartwarming tone, professional studio-quality animation, no text overlays. quality 4K"
Each prompt must be on a SEPARATE LINE. Each line contains EXACTLY ONE prompt. Do NOT combine multiple prompts in the same line. Do NOT use "." to separate prompts.

VIDEO PROMPTS
All prompts must be written in English.
Each prompt must include: same character description, same character clothing, same character appearance, same animation style, front camera angle, ${parentRole.toLowerCase()} and ${childRole.toLowerCase()} standing together, animal or object close in front of them, ${parentRole.toLowerCase()} pointing at object, ${childRole.toLowerCase()} answering.
Each prompt MUST include this exact style description at the end: "High-quality 3D animated film style inspired by modern Western animated cinema, soft rounded and friendly character designs, slightly exaggerated facial expressions for emotional clarity, clean and smooth surfaces, richly detailed yet whimsical environments, cinematic lighting with warm golden-hour tones, soft shadows and gentle depth of field, non-photorealistic, stylized realism, emotionally expressive, heartwarming tone, professional studio-quality animation, no text overlays. quality 4K"
Each prompt must be on a SEPARATE LINE. Each line contains EXACTLY ONE prompt. Do NOT combine multiple prompts in the same line.

ADDITIONAL CORRECTION RULES
The output format must be strictly followed.
Each IMAGE PROMPT must be written on a separate line.
Each VIDEO PROMPT must be written on a separate line.
One line must contain exactly ONE prompt.
Do NOT combine multiple prompts in one line.
Do NOT separate prompts using "." or any punctuation.

The number of IMAGE PROMPTS must be exactly ${ctaMode !== 'NONE' ? numScenes + 1 : numScenes}.
The number of VIDEO PROMPTS must be exactly ${ctaMode !== 'NONE' ? numScenes + 1 : numScenes}.

VIDEO PROMPTS must include the EXACT dialogue from SCENE SCRIPTS.
The ${parentRole.toLowerCase()} must speak Vietnamese.
The ${childRole.toLowerCase()} must answer in English.
The dialogue must appear inside quotation marks.

Example dialogue format inside video prompt:
${parentRole.toLowerCase()} says "${actualChildName} ơi, con mèo tiếng Anh là gì?"
${childRole.toLowerCase()} answers "Cat!"
${parentRole.toLowerCase()} asks "Thế còn con chó thì sao con?"
${childRole.toLowerCase()} answers "Dog!"

Do not change the wording of the dialogue.
Do not summarize the dialogue.
The dialogue in VIDEO PROMPTS must match the dialogue in SCENE SCRIPTS exactly.

EXAMPLE OUTPUT FORMAT:

Từ vựng trong video
Từ tiếng Việt: con khỉ
Tiếng Anh: Monkey
Phiên âm: /ˈmʌŋki/

Từ tiếng Việt: con voi
Tiếng Anh: Elephant
Phiên âm: /ˈelɪfənt/

Từ tiếng Việt: con sư tử
Tiếng Anh: Lion
Phiên âm: /ˈlaɪən/

Từ tiếng Việt: con hươu cao cổ
Tiếng Anh: Giraffe
Phiên âm: /dʒəˈrɑːf/

SCENE SCRIPTS
Scene 1 – Khu linh trưởng và voi ${parentVietnamese} và ${actualChildName} đứng cạnh nhau trong sở thú. Trước mặt họ là một con khỉ nhỏ đang ngồi trên tảng đá gần hàng rào. ${parentVietnamese} chỉ vào con khỉ và hỏi: "${actualChildName} ơi, con khỉ tiếng Anh là gì con?" Con nhìn con khỉ và trả lời: "Monkey!" Ngay cạnh đó là một chú voi con đang đứng ăn cỏ. ${parentVietnamese} chỉ vào con voi và hỏi: "Thế còn con voi thì sao con?" Con trả lời: "Elephant!"
Scene 2 – Đồng cỏ Safari ${parentVietnamese} và ${actualChildName} đứng cạnh nhau bên hàng rào gỗ. Trước mặt họ là một con sư tử con đang nằm sưởi nắng. ${parentVietnamese} chỉ vào con sư tử và hỏi: "${actualChildName} ơi, con sư tử tiếng Anh là gì?" Con nhìn con sư tử và trả lời: "Lion!" Ngay cạnh đó có một con hươu cao cổ nhỏ đang cúi đầu xuống gần họ. ${parentVietnamese} chỉ vào con hươu cao cổ và hỏi: "Thế còn con hươu cao cổ này thì sao con?" Con trả lời: "Giraffe!"

IMAGE PROMPTS
Scene 1 – Front camera view, [Character Description of ${parentRole}], [Character Description of ${childRole}], standing side by side facing the camera in a zoo enclosure, a cute baby monkey and a baby elephant are very close to them in the same frame, the ${parentRole.toLowerCase()} is pointing at the baby monkey, the ${childRole.toLowerCase()} is looking cheerfully at the baby monkey, High-quality 3D animated film style inspired by modern Western animated cinema, soft rounded and friendly character designs, slightly exaggerated facial expressions for emotional clarity, clean and smooth surfaces, richly detailed yet whimsical environments, cinematic lighting with warm golden-hour tones, soft shadows and gentle depth of field, non-photorealistic, stylized realism, emotionally expressive, heartwarming tone, professional studio-quality animation, no text overlays. quality 4K
Scene 2 – Front camera view, [Character Description of ${parentRole}], [Character Description of ${childRole}], standing side by side facing the camera next to a low wooden fence in a zoo, a cute baby lion and a baby giraffe are very close to them in the same frame, the ${parentRole.toLowerCase()} is pointing at the baby lion, the ${childRole.toLowerCase()} is looking cheerfully at the baby lion, High-quality 3D animated film style inspired by modern Western animated cinema, soft rounded and friendly character designs, slightly exaggerated facial expressions for emotional clarity, clean and smooth surfaces, richly detailed yet whimsical environments, cinematic lighting with warm golden-hour tones, soft shadows and gentle depth of field, non-photorealistic, stylized realism, emotionally expressive, heartwarming tone, professional studio-quality animation, no text overlays. quality 4K

VIDEO PROMPTS
Scene 1 – Front camera angle, [Character Description of ${parentRole}], [Character Description of ${childRole}], standing together side by side facing the camera in a zoo, a baby monkey and a baby elephant are close in front of them in the same frame, the ${parentRole.toLowerCase()} points his finger at the baby monkey and says "${actualChildName} ơi, con khỉ tiếng Anh là gì con?", the ${childRole.toLowerCase()} looks at the monkey and answers "Monkey!", High-quality 3D animated film style inspired by modern Western animated cinema, soft rounded and friendly character designs, slightly exaggerated facial expressions for emotional clarity, clean and smooth surfaces, richly detailed yet whimsical environments, cinematic lighting with warm golden-hour tones, soft shadows and gentle depth of field, non-photorealistic, stylized realism, emotionally expressive, heartwarming tone, professional studio-quality animation, no text overlays. quality 4K
Scene 2 – Front camera angle, [Character Description of ${parentRole}], [Character Description of ${childRole}], standing together side by side facing the camera by a low wooden zoo fence, a baby lion and a baby giraffe are close in front of them in the same frame, the ${parentRole.toLowerCase()} points his finger at the baby lion and says "${actualChildName} ơi, con sư tử tiếng Anh là gì?", the ${childRole.toLowerCase()} looks at the lion and answers "Lion!", High-quality 3D animated film style inspired by modern Western animated cinema, soft rounded and friendly character designs, slightly exaggerated facial expressions for emotional clarity, clean and smooth surfaces, richly detailed yet whimsical environments, cinematic lighting with warm golden-hour tones, soft shadows and gentle depth of field, non-photorealistic, stylized realism, emotionally expressive, heartwarming tone, professional studio-quality animation, no text overlays. quality 4K`;

      const parts: any[] = [];
      
      if (parentImage) {
        parts.push({ text: "Here is the reference image for the Parent:" });
        parts.push({ inlineData: { data: parentImage.data, mimeType: parentImage.mimeType } });
      }
      if (childImage) {
        parts.push({ text: "Here is the reference image for the Child:" });
        parts.push({ inlineData: { data: childImage.data, mimeType: childImage.mimeType } });
      }
      
      parts.push({ text: promptText });

      const response = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
      });

      let fullText = '';
      for await (const chunk of response) {
        fullText += chunk.text;
        setResult(fullText);
      }
      
      if (autoGenerateImages === 'YES') {
        const extractedPrompts = extractImagePrompts(fullText);
        if (extractedPrompts.length > 0) {
          generateImages(extractedPrompts);
        }
      }
    } catch (error) {
      console.error(error);
      setResult('Error generating content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-700 font-sans selection:bg-indigo-500 selection:text-white pb-24 relative">
      {/* Decorative Background Elements */}
      <div className="fixed top-40 -left-20 w-80 h-80 bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-40 -right-20 w-80 h-80 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none"></div>
      
      <header className="relative pt-4 z-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto h-24 bg-gradient-to-r from-[#4F8CFF] to-[#6C63FF] rounded-3xl flex items-center justify-between px-8 shadow-2xl shadow-blue-500/20 border border-white/20">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-inner transform -rotate-3 border border-white/30">
              <span className="text-3xl">👨‍👦</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-2xl tracking-tight text-white leading-none">
                  English With Kids
                </h1>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold text-white uppercase tracking-widest backdrop-blur-sm border border-white/20">
                  Video Script Generator
                </span>
              </div>
              <p className="text-sm font-medium text-blue-50/90 mt-1.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                Tạo kịch bản video học tiếng Anh vui nhộn cho trẻ em 📚✨
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">
              <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
              AI System Active
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          
          {/* User Guide Section */}
          <div className="guide-card">
            <div className="guide-header" onClick={() => setShowGuide(!showGuide)}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Hướng dẫn sử dụng</h2>
                  <p className="text-xs text-slate-500">Xem các bước để tạo nội dung hiệu quả nhất</p>
                </div>
              </div>
              {showGuide ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
            </div>
            
            {showGuide && (
              <div className="guide-content">
                <div className="guide-step">
                  <div className="step-number">1</div>
                  <div className="step-text">
                    <strong>Thiết lập nhân vật 👥</strong>
                    Chọn cặp nhân vật (Cha/Mẹ - Con) và tải ảnh chân dung rõ nét để AI nhận diện khuôn mặt chính xác.
                  </div>
                </div>
                <div className="guide-step">
                  <div className="step-number">2</div>
                  <div className="step-text">
                    <strong>Chọn chủ đề & Số cảnh 📚</strong>
                    Lựa chọn chủ đề học tập và số lượng cảnh quay bạn muốn tạo cho video giáo dục của mình.
                  </div>
                </div>
                <div className="guide-step">
                  <div className="step-number">3</div>
                  <div className="step-text">
                    <strong>Tạo nội dung 🤖</strong>
                    Nhấn "Tạo nội dung" để AI viết kịch bản, từ vựng và các câu lệnh (prompts) cho hình ảnh/video.
                  </div>
                </div>
                <div className="guide-step">
                  <div className="step-number">4</div>
                  <div className="step-text">
                    <strong>Sử dụng Prompts 🎞️</strong>
                    Sao chép Prompts hình ảnh hoặc video để đưa vào các công cụ tạo AI Video (như Kling, Luma, Runway).
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Configuration Panel */}
          <div className="space-y-6">
            <div className="config-card">
              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-100">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600 shadow-inner">
                  <Wand2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Cấu hình Video AI 🤖✨</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Tùy chỉnh nhân vật và bối cảnh giáo dục</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="col-span-1">
                    <label htmlFor="characterPair" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      👥 Nhân vật
                    </label>
                    <select
                      id="characterPair"
                      value={characterPair}
                      onChange={(e) => setCharacterPair(e.target.value)}
                      className="input-modern"
                    >
                      {CHARACTER_PAIRS.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="childName" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      👶 Tên bé
                    </label>
                    <input
                      type="text"
                      id="childName"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="VD: Bi"
                      className="input-modern"
                    />
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="clothingMode" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      👕 Trang phục
                    </label>
                    <select
                      id="clothingMode"
                      value={clothingMode}
                      onChange={(e) => setClothingMode(e.target.value)}
                      className="input-modern"
                    >
                      {CLOTHING_MODES.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[600px] mx-auto">
                    {/* Parent Image Upload */}
                    <div className="relative group">
                      {parentImage ? (
                        <div className="relative w-full h-[280px] max-w-[240px] mx-auto rounded-[18px] overflow-hidden border border-slate-200 shadow-lg">
                          <img src={`data:${parentImage.mimeType};base64,${parentImage.data}`} alt="Parent Ref" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <button onClick={() => setParentImage(null)} className="absolute top-2 right-2 bg-white/40 backdrop-blur-sm text-slate-900 p-1.5 rounded-full hover:bg-white/60 transition-colors">
                            <X size={14} />
                          </button>
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white/80 to-transparent text-slate-900 text-[11px] font-bold text-center py-2 pt-6">Ảnh cha/mẹ</div>
                        </div>
                      ) : (
                        <label className="upload-box">
                          <div className="icon-wrapper">
                            <Upload size={18} className="text-indigo-500" />
                          </div>
                          <span className="text-[13px] text-slate-400 font-medium">Tải ảnh cha/mẹ</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setParentImage)} />
                        </label>
                      )}
                    </div>

                    {/* Child Image Upload */}
                    <div className="relative group">
                      {childImage ? (
                        <div className="relative w-full h-[280px] max-w-[240px] mx-auto rounded-[18px] overflow-hidden border border-slate-200 shadow-lg">
                          <img src={`data:${childImage.mimeType};base64,${childImage.data}`} alt="Child Ref" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <button onClick={() => setChildImage(null)} className="absolute top-2 right-2 bg-white/40 backdrop-blur-sm text-slate-900 p-1.5 rounded-full hover:bg-white/60 transition-colors">
                            <X size={14} />
                          </button>
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-white/80 to-transparent text-slate-900 text-[11px] font-bold text-center py-2 pt-6">Ảnh của bé</div>
                        </div>
                      ) : (
                        <label className="upload-box">
                          <div className="icon-wrapper">
                            <Upload size={18} className="text-indigo-500" />
                          </div>
                          <span className="text-[13px] text-slate-400 font-medium">Tải ảnh bé</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setChildImage)} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
                  <div className="col-span-1">
                    <label htmlFor="topic" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      📚 Chủ đề
                    </label>
                    <select
                      id="topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="input-modern"
                    >
                      {TOPICS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="numScenes" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      🎞 Số cảnh
                    </label>
                    <select
                      id="numScenes"
                      value={numScenes}
                      onChange={(e) => setNumScenes(Number(e.target.value))}
                      className="input-modern"
                    >
                      {SCENE_COUNTS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="autoGenerateImages" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      🤖 Auto ảnh
                    </label>
                    <select
                      id="autoGenerateImages"
                      value={autoGenerateImages}
                      onChange={(e) => setAutoGenerateImages(e.target.value)}
                      className="input-modern"
                    >
                      {AUTO_IMAGE_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="aspectRatio" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      📐 Khổ ảnh
                    </label>
                    <select
                      id="aspectRatio"
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="input-modern"
                    >
                      {ASPECT_RATIOS.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <label htmlFor="ctaMode" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      📣 CTA cuối video
                    </label>
                    <select
                      id="ctaMode"
                      value={ctaMode}
                      onChange={(e) => setCtaMode(e.target.value)}
                      className="input-modern"
                    >
                      {CTA_OPTIONS.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {ctaMode === 'CUSTOM' && (
                  <div className="space-y-1.5">
                    <label htmlFor="customCtaText" className="block text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                      💬 Nội dung CTA
                    </label>
                    <input
                      type="text"
                      id="customCtaText"
                      value={customCtaText}
                      onChange={(e) => setCustomCtaText(e.target.value)}
                      placeholder="Ví dụ: Hãy follow kênh để học tiếng Anh mỗi ngày"
                      className="input-modern"
                    />
                  </div>
                )}

                <button
                  onClick={generateContent}
                  disabled={loading}
                  className="primary-button"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      ĐANG TẠO...
                    </>
                  ) : (
                    <>
                      <Play size={18} fill="currentColor" />
                      TẠO NỘI DUNG
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="space-y-8">
            <div className="result-panel">
              <div className="border-b border-slate-100 px-6 py-5 flex items-center justify-between sticky top-0 z-10 bg-white/80 backdrop-blur-md rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">KẾT QUẢ</h2>
                </div>
              </div>

              {/* Fixed Utility Toolbar */}
              {result && (
                <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 px-6 py-3 sticky top-[73px] z-10 flex items-center gap-3 overflow-x-auto">
                  <button
                    onClick={handleDownloadAllData}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-all whitespace-nowrap shadow-sm"
                  >
                    <Save size={14} />
                    Lưu Data
                  </button>
                  <button
                    onClick={handleDownloadAllImages}
                    disabled={Object.keys(generatedImages).length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm"
                  >
                    <Download size={14} />
                    Tải Ảnh
                  </button>
                  <button
                    onClick={copyVocabulary}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-all whitespace-nowrap shadow-sm"
                  >
                    {copiedVocab ? <Check size={14} /> : <Copy size={14} />}
                    Copy Vocabulary
                  </button>
                  <button
                    onClick={() => copySection('IMAGE PROMPTS', setCopiedImage)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-all whitespace-nowrap shadow-sm"
                  >
                    {copiedImage ? <Check size={14} /> : <Copy size={14} />}
                    Copy Image Prompt
                  </button>
                  <button
                    onClick={() => copySection('VIDEO PROMPTS', setCopiedVideo)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-all whitespace-nowrap shadow-sm"
                  >
                    {copiedVideo ? <Check size={14} /> : <Copy size={14} />}
                    Copy Video Prompt
                  </button>
                </div>
              )}

              <div className="p-7 flex-1 overflow-auto">
                {!result && !loading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 min-h-[400px]">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                      <FileText size={24} className="text-slate-300" />
                    </div>
                    <p className="text-sm font-medium">Chọn cài đặt và nhấn TẠO NỘI DUNG để bắt đầu</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Vocabulary Section */}
                    {result.includes('Từ vựng trong video') && (
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm bg-slate-50">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <span>📚</span> Từ vựng
                          </h3>
                          <button
                            onClick={copyVocabulary}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 shadow-sm"
                          >
                            {copiedVocab ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copiedVocab ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </div>
                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed whitespace-pre-wrap font-sans p-4 text-slate-600">
                          {result.split(/(?=SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/)[0].replace('Từ vựng trong video', '').trim()}
                        </div>
                      </div>
                    )}

                    {/* Scripts Section */}
                    {result.includes('SCENE SCRIPTS') && (
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm bg-slate-50">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <span>🎬</span> Kịch bản
                          </h3>
                          <button
                            onClick={() => copySection('SCENE SCRIPTS', setCopiedScript)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 shadow-sm"
                          >
                            {copiedScript ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copiedScript ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </div>
                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed whitespace-pre-wrap font-sans p-4 text-slate-600">
                          {(() => {
                            const parts = result.split(/(?=Từ vựng trong video|SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/);
                            const section = parts.find(p => p.trim().startsWith('SCENE SCRIPTS'));
                            return section ? section.replace('SCENE SCRIPTS', '').trim() : '';
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Image Prompts Section */}
                    {result.includes('IMAGE PROMPTS') && (
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm bg-slate-50">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <span>🖼</span> Prompt ảnh
                          </h3>
                          <button
                            onClick={() => copySection('IMAGE PROMPTS', setCopiedImage)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 shadow-sm"
                          >
                            {copiedImage ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copiedImage ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </div>
                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed whitespace-pre-wrap font-sans p-4 text-slate-600">
                          {(() => {
                            const parts = result.split(/(?=Từ vựng trong video|SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/);
                            const section = parts.find(p => p.trim().startsWith('IMAGE PROMPTS'));
                            return section ? section.replace('IMAGE PROMPTS', '').trim() : '';
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Video Prompts Section */}
                    {result.includes('VIDEO PROMPTS') && (
                      <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm bg-slate-50">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                          <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <span>🎥</span> Prompt video
                          </h3>
                          <button
                            onClick={() => copySection('VIDEO PROMPTS', setCopiedVideo)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 shadow-sm"
                          >
                            {copiedVideo ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copiedVideo ? 'Đã chép' : 'Sao chép'}
                          </button>
                        </div>
                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed whitespace-pre-wrap font-sans p-4 text-slate-600">
                          {(() => {
                            const parts = result.split(/(?=Từ vựng trong video|SCENE SCRIPTS|IMAGE PROMPTS|VIDEO PROMPTS)/);
                            const section = parts.find(p => p.trim().startsWith('VIDEO PROMPTS'));
                            return section ? section.replace('VIDEO PROMPTS', '').trim() : '';
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Render Images Section */}
            {(extractImagePrompts(result).length > 0 || Object.keys(generatedImages).length > 0) && (
              <div className="result-panel transition-all">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wide">
                      <span>📷</span> Ảnh đã tạo
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {Object.keys(generatedImages).length > 0 && (
                      <button
                        onClick={handleDownloadAllImages}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors text-slate-700 shadow-sm"
                      >
                        <Download size={14} />
                        Tải tất cả
                      </button>
                    )}
                    <button
                      onClick={() => generateImages()}
                      disabled={generatingImages || extractImagePrompts(result).length === 0}
                      className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white px-4 py-1.5 rounded-lg text-[13px] font-bold flex items-center gap-1.5 disabled:opacity-70 transition-all shadow-md shadow-blue-500/20"
                    >
                      {generatingImages ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                      Tạo ảnh
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {extractImagePrompts(result).map((prompt, index) => (
                    <div key={index} className="bg-slate-50/50 rounded-[14px] border border-slate-100 hover:border-indigo-100 transition-colors p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-slate-900 text-sm">Cảnh {index + 1}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-4 line-clamp-3 hover:line-clamp-none transition-all" title={prompt}>{prompt}</p>
                      
                      {generatedImages[index] ? (
                        <div className="space-y-3">
                          <div className="rounded-xl overflow-hidden border border-slate-100 shadow-sm group relative">
                            <img src={generatedImages[index]} alt={`Cảnh ${index + 1}`} className="w-full object-cover aspect-video transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors" />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownloadImage(index, generatedImages[index])}
                              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors flex-1 shadow-sm"
                            >
                              <Download size={14} />
                              Tải về
                            </button>
                            <button
                              onClick={() => generateSingleImage(index, prompt)}
                              disabled={generatingImages}
                              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors flex-1 shadow-sm disabled:opacity-50"
                            >
                              {generatingImages ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                              Tạo lại
                            </button>
                          </div>
                        </div>
                      ) : generatingImages ? (
                        <div className="w-full aspect-video bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400 border border-slate-200">
                          <Loader2 size={20} className="animate-spin" />
                        </div>
                      ) : (
                        <div className="w-full aspect-video bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 border-dashed">
                          <span className="text-xs font-bold">Chưa tạo ảnh</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

      </main>

      {/* Floating Veo3 Tool & Community Link */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-[700px]">
        <a
          href="https://zalo.me/g/ugjxpz129"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white/95 backdrop-blur-md border border-orange-200 rounded-2xl p-2.5 flex items-center justify-between shadow-[0_15px_50px_rgba(251,146,60,0.25)] hover:scale-[1.02] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200 group-hover:rotate-6 transition-transform">
              <Video size={20} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-sm font-black text-orange-900 uppercase tracking-tight">TOOL tạo video Veo3 tự động 🚀</h3>
              <p className="text-[11px] text-orange-700 font-bold">Giải pháp tạo video AI chuyên nghiệp, tự động hoàn toàn.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 border-l border-orange-100 pl-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Hotline</p>
              <p className="text-base font-black text-orange-600 tracking-tighter">0879.345.345</p>
            </div>
            <div className="bg-orange-600 text-white px-6 py-3 rounded-xl text-[12px] font-black uppercase tracking-widest shadow-md shadow-orange-200 group-hover:bg-orange-700 transition-colors">
              Tham gia ngay
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
