const web3 = require('../ethereum/web3');

const factory = require('../ethereum/factory');
const Vote = require('../ethereum/vote');

const voteAddressList = async (isPrivate) => {
    // const address = web3.eth.accounts.create(password).address;
    return await factory.methods.getDeployedVotes(isPrivate).call();
};

const getNumVotedVoters = async (voteAddress) => {
    return await Vote(voteAddress).methods.getNumVotedVoters().call();
};

const voteSummary = async (voteAddress) => {
    const summary = await Vote(voteAddress)
        .methods.getVoteSummary()
        .call();
    summary['6'] = voteAddress;
    return summary;
};

const voteSummaryList = async (voteAddressList) => {
    const summaryList = await voteAddressList.map(async (voteAddress) => await voteSummary(voteAddress));
    const resultList = await Promise.all(summaryList);
    return resultList;
};

const getVoteList = async (isPrivate) => {
    const addressList = await voteAddressList(isPrivate);
    return await voteSummaryList(addressList);
};

const setVoteDescription = async (voteAddress, voterAddress, voteDescription) => {
    await Vote(voteAddress).methods.setVoteDescription(voteDescription).send({from: voterAddress});
};

const setVoteState = async (voteAddress, voterAddress, voteState) => {
    await Vote(voteAddress).methods.setVoteState(voteState).send({from: voterAddress});
};

const setVoteDate = async (voteAddress, voterAddress, startDate, endDate) => {
    await Vote(voteAddress).methods.setDate(startDate, endDate).send({from: voterAddress});
};

const voting = async (voteAddress, voterAddress, candidateIndex) => {
    const ownerAddress = await Vote(voteAddress).methods.getOwner().call();
    console.log(ownerAddress);
    await Vote(voteAddress)
        .methods.voting(candidateIndex, voterAddress)
        .send({from: ownerAddress});
};

module.exports = {
    getVoteList,
    getNumVotedVoters,
    voteAddressList,
    voteSummary,
    voteSummaryList,
    setVoteDescription,
    setVoteState,
    setVoteDate,
    voting
};
