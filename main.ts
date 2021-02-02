// deno-lint-ignore-file camelcase
import { Client, Intents, Message, Embed, MessageAttachment, GatewayIntents } from 'https://cdn.jsdelivr.net/gh/harmonyland/harmony@dbb80f30/mod.ts';
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.5-alpha/deno-dom-wasm.ts";
import { Image } from 'https://deno.land/x/imagescript@1.1.16/mod.ts';
import { HSLToHex } from './color.ts';

// import { Client } from 'https://deno.land/x/discorddeno@0.0.1/index.ts';

import { parse } from './lua.ts';

interface ItemInfo {
    name: string;
    itemId: string;
    description: string[];
}

interface Gearset {
    main?: string;
    sub?: string;
    range?: string;
    ammo?: string;

    head?: string;
    neck?: string;
    ear1?: string;
    left_ear?: string;
    right_ear?: string;
    ear2?: string;
}

const SLOTS = [
    ['main', 'sub', 'range', 'ammo'],
    ['head', 'neck', 'ear1', 'left_ear', 'ear2', 'right_ear'],
    ['body', 'hands', 'ring1', 'left_ring', 'ring2', 'right_ring'],
    ['back', 'waist', 'legs', 'feet'],
];

const ROW_NAMES = [
    'Main     Sub     Range     Ammo',
    'Head     Neck    Ear1      Ear2',
    'Body     Hands   Ring1     Ring2',
    'Back     Waist   Legs      Feet'
]

const DISCORD_TOKEN = Deno.readTextFileSync('.token').trim();

const itemDescriptionExpr = /(([\w\s\d\:\+\-\"\.]{1,28}\d+?%?)\s|\"[\w\s\d\'\:\+\-\.]+\"|[\w\s\d\'\:\+\-\.]+:|.+)/g;
const setName = /sets\.(.+)\s?=/;
const itemId = /item\/(\d+)/;
const tableExpr = /\{((?:.|\n)+)\}/gm;
const tableElements = /([\w\d]+)\=(.+)/g;

const getItemInfo = async (name: string): Promise<ItemInfo> => {
    if (!name) {
       return {
           name: '',
           description: [],
           itemId: '0'
       } 
    }
    const response = await fetch(`https://www.ffxiah.com/search/item?q=${encodeURIComponent(name)}`);
    let body: string;
    let url = response.url;
    if (!itemId.test(response.url)) {
        const pageBody = await response.text();
        const doc = new DOMParser().parseFromString(pageBody, 'text/html');

        if (doc) {
            url = [...doc.querySelectorAll('.stdtbl.stdlist a')].map((a: unknown) => (a as Element).getAttribute('href') || '').sort((a,b) => b.localeCompare(a))[0]
            
            if (url) {
                const newResponse = await fetch(url);
                body = await newResponse.text();
            } else {
                console.error(`Unknown Item? Name: ${name}, ${response.url}`)
                url = 'item/0';
                body = '';
            }
        } else {
            url = 'item/0';
            body = '';
        }
    } else {
        body = await response.text();
    }

    const bodyDoc = new DOMParser().parseFromString(body, 'text/html');
    // const description = bodyDoc?.querySelector('.item-stats')?.innerHTML.split('<br>')[1].match(itemDescriptionExpr) || [] as string[];
    const description = bodyDoc?.querySelector('.item-stats')?.innerHTML.split('<br>')[1].split('\n') || [] as string[];

    return {
        itemId: url.match(itemId)?.[1] || '0',
        description: description.map(line => line.replace(/\'/g, '\\\'').trim()),
        name
    };
}

const getGearset = (msg: string) => {
    const table = msg.match(tableExpr)?.[0];

    
    if (!table) {
        return {};
    } else {
        return parse(`return ${table.replace(/\n/g, '')}`);
    }
}

const colorWheel = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
};
const getMod = (str?: string) => {
    if (!str) return [45, 65];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    return [
        Math.floor((hash >> 16 & 0x000000FF) / 256 * 0.7 * 100 + 15),
        Math.floor((hash >> 8 & 0x000000FF) / 256 * 0.30 * 100 + 45)
    ];
}
const getSetColor = (str: string, mod?: string) => {
    const [s, l] = getMod(mod);
    // console.log(`0x${HSLToHex(colorWheel(str), s, l)}`, parseInt(`${HSLToHex(colorWheel(str), s, l)}`, 16))
    return HSLToHex(colorWheel(str), s, l);
}

const onMessage = async (msg: Message) => {
    const gearset = getGearset(msg.content);

    const fields: [string, string[]][] = [];

    const DUPE_SKIP = [
        'ear1',
        'ear2',
        'ring1',
        'ring2'
    ];

    const DUPE_MAP: {[key: string]: string} = {
        'ear1': 'left_ear',
        'ear2': 'right_ear',
        'ring1': 'left_ring',
        'ring2': 'right_ring',
    }

    const dupeCheck: string[] = [];
    const alreadyDesc: Set<string> = new Set();

    for (const row of SLOTS) {
        let value = '';
        const images: string[] = [];
        for (const slot of row) {
            if (dupeCheck.includes(slot)) {
                continue;
            }
            const name = gearset[slot]?.name || gearset[slot];
            const augments: string[] = gearset[slot]?.augments || [];
            const item: ItemInfo = await getItemInfo(name);
            if (!item || item.itemId === '0') {
                if (!DUPE_SKIP.includes(slot)) {
                    value += '[Empty](https://www.ffxiah.com/item/0) | ';
                    images.push(`https://static.ffxiah.com/images/icon/${item.itemId}.png`);
                }
            } else {
                const augText = augments.length ? `\n\nAugments: \n${augments.join('\n')}` : '';
                let descriptionText = alreadyDesc.has(name) ? '' : `\n\n${item.description.join('\n')}` || '';

                if (descriptionText.length > 220) {
                    descriptionText = descriptionText.substr(0, 220) + '...';
                }
                if (augText.length && descriptionText.length + augText.length > 220) {
                    descriptionText = '';
                }
                value += `[${item.name}](https://www.ffxiah.com/item/${item.itemId} '${name}${descriptionText}${augText}') | `;
                images.push(`https://static.ffxiah.com/images/icon/${item.itemId}.png`);
                if (DUPE_MAP[slot]) {
                    dupeCheck.push(DUPE_MAP[slot]);
                }
                alreadyDesc.add(name);
            }
        }

        fields.push([value.slice(0, -2), images])
    }

    const image = new Image(32*4, 32*4);
    const embed = new Embed();
    const author = await msg.guild?.members.fetch(msg.author.id);
    embed.setDescription(msg.content.match(setName)?.[1] || 'Gearset');
    embed.setColor(getSetColor(JSON.stringify(gearset)));
    embed.setAuthor({
        name: author?.displayName,
        icon_url: msg.author.avatarURL()
    })
    
    console.log('Deleting...');
    await msg.delete();

    let i = 0;
    let j = 0;
    for (const [field, images] of fields) {
        // console.log(field.length);
        embed.addField(ROW_NAMES[i], field);
        for (const img of images) {
            const imgResp = await fetch(img);
            const data = await imgResp.arrayBuffer();
            const utf8Data = new Uint8Array(data);
            const icon = await Image.decode(utf8Data);

            image.composite(icon, (j * 32) % (32*4), 32 * Math.floor((j * 32) / (32 * 4)))
            j++;
        }
        i++;
    }
    image.resize(32*4*1.25, 32*4*1.25);
    const imgData = await image.encode();
    const attach = new MessageAttachment('gearset.png', imgData);
    embed.attach(attach);
    embed.setImage({
        height: 32*4,
        width: 32*4,
        url: 'attachment://gearset.png'
    });

    console.log('Sending...');
    await msg.channel.send(embed, {file: attach})

    return JSON.stringify(fields);
}

const client = new Client();

client.on('ready', () => {
    console.log('Body is ready!');
})

client.on('messageCreate', async (msg: Message) => {
    if (msg.content.indexOf('!gs') === 0) {
        try {
            await onMessage(msg);
        } catch(e) {
            console.error(e);
            console.log(e.errors);
        }
    }
});


client.connect(DISCORD_TOKEN, Intents.NonPrivileged)