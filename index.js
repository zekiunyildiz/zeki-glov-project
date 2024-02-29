const crypto = require('crypto');

const RATE_LIMIT = 4; 
const RATE_LIMIT_WINDOW = 60 * 1000; 

const users = {}; 

// Kullanıcı ID'sini hashliyorum
function hashUserIdToGroup(userId) {
    const hash = crypto.createHash('md5').update(userId).digest('hex');
    const group = parseInt(hash.substring(0, 2), 16) % 10 + 1; 
    return group;
}

// token'ın geçerli olup olmadığını kontrol etmek için
function isValidAuthToken(authHeader) {
    const tokenRegex = /^Bearer USER(\d{3})$/;
    const match = tokenRegex.exec(authHeader);
    return match !== null;
}

// kullanıcı ID'sini çıkarmak için
function extractUserId(authHeader) {
    return authHeader.split(' ')[1].substring(4); 
}

//Kullanıcının oran limitini kontrol etmek için aşağıdaki fonskiyon çalışor
function checkAndUpdateRateLimit(userId) {
    const currentTime = Date.now();
    const userData = users[userId];

    if (userData && (currentTime - userData.lastRequestTime) < RATE_LIMIT_WINDOW) {
        if (userData.requestCount >= RATE_LIMIT) {
            return false; 
        }
        userData.requestCount += 1;
    } else {
        users[userId] = { requestCount: 1, lastRequestTime: currentTime, visitCount: userData ? userData.visitCount + 1 : 1, streamSeq: 0 };
    }
    return true;
}


exports.secureAPIEndpoint = (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !isValidAuthToken(authHeader)) {
        return res.status(401).send({ error: 'Unauthorized' });
    }

    const userId = extractUserId(authHeader);
    const stream = req.query.stream === 'true';
    const userGroup = hashUserIdToGroup(userId);

    if (!checkAndUpdateRateLimit(userId)) {
        return res.status(429).send({ error: 'Rate Limit Exceeded' });
    }

    const userData = users[userId];
    const responsePayload = {
        message: `Welcome USER_${userId}, this is your visit #${userData.visitCount}`,
        group: userGroup,
        rate_limit_left: RATE_LIMIT - userData.requestCount,
        stream_seq: stream ? userData.streamSeq : 0,
    };

    if (stream) {
        const sendResponse = (count) => {
        if (count > 4) {
            res.end(); 
            return;
        }
        userData.streamSeq += 1; 
        res.write(JSON.stringify({ ...responsePayload, stream_seq: userData.streamSeq }) + '\n');
        setTimeout(() => sendResponse(count + 1), 1000); 
    };

    if (stream) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        sendResponse(0);
    } else {
        res.status(200).send(responsePayload);
    }
    } else {
        res.status(200).send(responsePayload);
    }
};
