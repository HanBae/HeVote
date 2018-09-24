const fs = require('fs');
const path = require('path');

const electionApi = require('../ethereum/api/election.api');
const electionFactoryApi = require('../ethereum/api/election.factory.api');
const candidateApi = require('../ethereum/api/candidate.api');
const voterApi = require('../ethereum/api/voter.api');

const electionRequest = require('../models/election.request');

const hec = require('../hec/hec');
const ipfs = require('../ipfs/ipfs');

const mkdirSync = require('../utils/fs.util').mkdirSync;
const dateStringToTimestamp = require('../utils/time.util').dateStringToTimestamp;


exports.index = async (req, res) => {
    try {
        const electionSummaryList =
            await electionApi.getElectionSummaryList({
                isFinite: req.originalUrl === '/finite'
            });
        res.render('election/electionList', {
            isFinite: req.originalUrl === '/finite' ? 'finite' : 'public',
            electionList: electionSummaryList
        });
    } catch (err) {
        res.send(err.toString());
    }
};

exports.electionRequestPage = (req, res) =>
    res.render('election/electionRequest');

exports.electionRequestUser = (req, res) => {
    const data = req.body;

    // 데이터 가공
    data.finiteElection = data.finiteElection === 'true';
    data.startDate = dateStringToTimestamp(data.startDate);
    data.endDate = dateStringToTimestamp(data.endDate);

    // mongoDB에 요청을 저장합니다.
    data.userName = req.user.username;
    data.electionOwner = req.user.etherAccount;
    const election = new electionRequest(data);
    election.save((err) => {
        if (err) return res.send(err.message);
        return res.redirect('/');
    });
};

exports.electionCreatePage = (req, res) =>
    res.render('election/electionCreate');

// number보다 큰 수 중에서 가장 작은 소수를 찾는 메소드
function getPrimeNumber(number) {

    // 소수를 구하기 위한 반복문(number+100까지)
    for (let i = number; i <= number + 100; i++) {
        let isPrimeNumber = true;
        // 1과 자기 자신을 제외한 정수 중에 나눠지는 정수가 있는지 체크
        const rootOfNumber = Math.sqrt(i);
        for (let j = 2; j < rootOfNumber; j++) {
            if (i % j === 0) {
                isPrimeNumber = false;
            }
        }

        // 소수이면 결과값을 반환
        if (isPrimeNumber) {
            return i;
        }
    }

    return undefined;
}

exports.electionCreate = async (req, res) => {
    const adminAddress = await electionFactoryApi.getOwner();
    if (req.user.etherAccount !== adminAddress) {
        res.send("관리자만 이용 가능합니다.")
    }

    const data = req.body;

    const election = await electionFactoryApi.makeNewElection(adminAddress,
        data.electionName, data.electionDescription, data.electionOwner,
        data.startDate, data.endDate, "", data.finiteElection);
    console.log(election);
    const voterCountPrime = getPrimeNumber(data.voterCount);
    const L = 6 + 2 * Math.ceil(Math.log(voterCountPrime) * 3) / (Math.log(2.0) * 44) + 1;
    console.log(voterCountPrime, L);
    // hec으로 공개키를 저장합니다.
    // await hec.createKeys(deployedPublicElections[0], voterCountPrime, L, 'data', async () => {
    //     const publicKeyFilePath = "./data/publicKey/" + deployedPublicElections[0] + ".bin";
    //     const fileSize = fs.statSync(publicKeyFilePath).size;
    //     if (fileSize > 0) {
    //         console.log("good. Key files saved");
    //     } else {
    //         console.error("failed: file not Saved");
    //     }
    // });
    res.send("완료");
};

exports.detail = async (req, res) => {
    const electionAddress = req.params.address;
    try {
        let electionDetail = {};

        electionDetail.summary = await electionApi.getElectionSummary(electionAddress);
        electionDetail.candidateList = await candidateApi.getCandidateList(electionAddress);
        electionDetail.ballotCount = await electionApi.getBallotCount(electionAddress);
        if (electionDetail.summary['electionState'] === "종료") {
            const result = await electionApi.getTallyResult(electionAddress);
            if (result) {
                // 결과 String을 배열로 만듦
                const resultArray = result.split(',').map((val) => parseInt(val));
                electionDetail.tallyResult = resultArray;

                const max = Math.max.apply(null, resultArray);
                electionDetail.resultName = [];
                for (let i = 0; i < resultArray.length; i++) {
                    if (resultArray[i] === max)
                        electionDetail.resultName.push(electionDetail.candidateList[i].name);
                }
            }
        }
        if (req.user) {
            const voterAddress = req.user.etherAccount;
            electionDetail.voterState = await voterApi.getVoterState(electionAddress, voterAddress);
            const isOwner = await electionApi.isOwner(electionAddress, voterAddress);
            if (isOwner) electionDetail.owner = isOwner;
        }

        res.render('election/electionDetail', {
            electionDetail: electionDetail,
            path: req.path
        });
    } catch (err) {
        console.log(err);
        res.send(err.toString());
    }
};
exports.changeState = async (req, res) => {

    if (!req.user) res.redirect('/login');

    const electionAddress = req.params.address;
    const ownerAddress = req.user.etherAccount;

    try {
        const isVoteOwner = await electionApi.isOwner(electionAddress, ownerAddress);
        if (isVoteOwner) {
            const state = req.body.electionState;
            await electionApi.setElectionState(electionAddress, ownerAddress, state);
            const electionState = await electionApi.getElectionState(electionAddress);
            if (electionState === '3') {
                // 투표 집계

                // 선거 폴더의 파일 이름(=유권자 주소)을 모두 읽는다
                const electionDirPath = `./data/candidate/${electionAddress}`;
                const files = fs.readdirSync(path.resolve(electionDirPath));

                // 선거 결과를 저장할 디렉토리를 만든다
                const electionResultDirPath = path.resolve(`./data/result/${electionAddress.toLowerCase()}`);
                mkdirSync(electionResultDirPath);

                let lock = 0;
                for (let i = 0; i < files.length; i++) {
                    // 유권자 주소로 이더리움에 저장된 IPFS 해쉬값을 읽는다
                    const fileHash = await electionApi.getBallot(electionAddress, files[i]);
                    // 모든 유권자 주소의 IPFS 파일을 모두 다운받거나, 있으면 그걸 사용한다
                    ipfs.files.get(fileHash, async (err, files) => {
                        if (err) {
                            console.log(err);
                        }
                        fs.writeFileSync(`${electionResultDirPath}/${files[0].path}`,
                            files[0].content.toString('utf8'));
                        lock += 1;
                        if (lock === files.length) {
                            // 동형암호로 집계를 한다
                            const candidateListLength = await candidateApi.getCandidateLength(electionAddress);
                            await hec.tally(electionAddress, candidateListLength,
                                "data", async (out, err) => {
                                    if (err) {
                                        return res.send(err);
                                    }
                                    console.log(out);
                                    const resultArray = hec.getResult(electionAddress);
                                    // 이더리움에 결과 저장
                                    await electionApi.setTallyResult(electionAddress, ownerAddress, resultArray.toString());

                                    res.redirect(req.path);
                                });
                        }
                    });
                }
            } else {
                res.redirect(req.path);
            }
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        res.send(err.toString());
    }
};
exports.changeInformation = async (req, res) => {
    const electionAddress = req.params.address;
    const ownerAddress = req.user.etherAccount;

    try {
        const isVoteOwner = await electionApi.isOwner(electionAddress, ownerAddress);
        if (isVoteOwner) {

            const electionDescription = req.body.electionDescription;
            const startVoteDate = Date.parse(req.body.startDate) / 1000;
            const endVoteDate = Date.parse(req.body.endDate) / 1000;

            if (electionDescription)
                await electionApi.setElectionDescription(electionAddress, ownerAddress, electionDescription);
            if (startVoteDate && endVoteDate)
                await electionApi.setElectionDate(
                    electionAddress, ownerAddress, startVoteDate, endVoteDate);
        } else {
            res.redirect('/login');
        }
        res.redirect(req.path.substring(0, req.path.length - 7));
    } catch (err) {
        res.send(err.toString());
    }
};
