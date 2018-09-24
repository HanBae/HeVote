'use strict';

exports.requireLogin = (req, res, next) => {
    if(req.user) {
        res.locals.user = req.user;
        return next();
    }
    res.redirect('/login');
};