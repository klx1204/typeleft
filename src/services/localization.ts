import { remote } from 'services/remote';
import transport from 'services/transport';

const names = [
    'InputFootnoteDefine',
    'InputYAMLFrontMatter',
    'InputMathFormula',
    'InputLanguageIdentifier',
    'ClickToAddAnImage',
    'LoadImageFail',
    'Footnote'
];

function applyTranslations(dic: Record<string, string>) {
    for (const key in dic) {
        document.documentElement.style.setProperty(`--${key}`, `'${dic[key]}'`);
    }
}

remote.getStringResources({ names }).then(applyTranslations);

transport.addListener('SettingsChanged', (payload: any) => {
    if (payload.lang) {
        remote.getStringResources({ names }).then(applyTranslations);
    }
});
