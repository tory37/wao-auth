"use strict";

const express = require(`express`);
const router = express.Router();
const bcrypt = require(`bcryptjs`);
const jwt = require(`jsonwebtoken`);
var passport = require(`passport`);

// Load input validation
const isRegisterInputValid = require(`../../validation/register`);
const isLoginInputValid = require(`../../validation/login`);
const isUpdateUserInputValid = require(`../../validation/updateUser`);
const isUpdatePasswordInputValid = require(`../../validation/updatePassword`);
// Load User model
const User = require(`../../models/User`);
const { addErrorMessages, createErrorObject, hasErrors } = require(`../../utils/errorHandler`);

router.get(`/`, passport.authenticate(`jwt`, { session: false }), (req, res, next) => {
	const errorObject = createErrorObject();

	const id = req.user._id;

	if (!id) {
		addErrorMessages(errorObject, `Bad auth provided.`);
		return res.status(404).json(errorObject);
	}

	User.findOne({ _id: id }, { upsert: false }).then(user => {
		if (!user) {
			addErrorMessages(errorObject, `User not found`);
			return res.status(404).json(errorObject);
		} else {
			console.log(user);
			return res.status(200).json({
				username: user.username,
				email: user.email,
				createdAt: user.createdAt,
				roles: user.roles,
				updatedAt: user.updatedAt,
				imageUrl: user.imageUrl,
				color: user.color,
				_id: user._id
			});
		}
	});
});

router.post(`/`, passport.authenticate(`jwt`, { session: false }), (req, res, next) => {
	const errorObject = createErrorObject();

	const userId = req.user.id;
	const idToUpdate = req.query.id;

	if (!userId) {
		addErrorMessages(errorObject, `Bad auth provided.`);
		return res.status(404).json(errorObject);
	}

	if (userId !== idToUpdate) {
		addErrorMessages(errorObject, `You can only update your own user information.`);
		return res.status(404).json(errorObject);
	}

	try {
		// Form validation
		const isValid = isUpdateUserInputValid(req.body, errorObject);
		// Check validation
		if (!isValid) {
			return res.status(400).json(errorObject);
		}

		// Check if email exists
		User.findOne({ email: req.body.email }, { upsert: false }).then(user => {
			if (user && user.id !== userId) {
				addErrorMessages(errorObject, `Email already exists`);
			}

			User.findOne({ username: req.body.username }, { upsert: false }).then(user => {
				if (user && user.id !== userId) {
					addErrorMessages(errorObject, `Username already exists`);
				}

				if (hasErrors(errorObject)) {
					return res.status(400).json(errorObject);
				}

				if (req.body.email) {
					req.user.email = req.body.email;
				}

				if (req.body.username) {
					req.user.username = req.body.username;
				}

				if (req.body.imageUrl) {
					req.user.imageUrl = req.body.imageUrl;
				}

				if (req.body.color) {
					req.user.color = req.body.color;
				}

				req.user
					.save()
					.then(user => {
						res.status(200).json({
							username: user.username,
							email: user.email,
							updatedAt: user.updatedAt,
							roles: user.roles,
							createdAt: user.createdAt,
							imageUrl: user.imageUrl,
							color: user.color,
							_id: user._id
						});
					})
					.catch(err => {
						addErrorMessages(errorObject, err.message);
						return res.status(400).json(errorObject);
					});
			});
		});
	} catch (err) {
		addErrorMessages(errorObject, err);
		next(errorObject);
	}
});

router.post(`/password`, passport.authenticate(`jwt`, { session: false }), (req, res, next) => {
	const errorObject = createErrorObject();

	const userId = req.user.id;
	const idToUpdate = req.query.id;

	if (!userId) {
		addErrorMessages(errorObject, `Bad auth provided.`);
		return res.status(404).json(errorObject);
	}

	if (userId !== idToUpdate) {
		addErrorMessages(errorObject, `You can only update your own password.`);
		return res.status(404).json(errorObject);
	}

	try {
		// Form validation
		const isValid = isUpdatePasswordInputValid(req.body, errorObject);
		// Check validation
		if (!isValid) {
			return res.status(400).json(errorObject);
		}

		bcrypt.genSalt(10, (err, salt) => {
			// Hash password before saving in database
			if (err) throw err;
			bcrypt.hash(req.body.password, salt, (err, hash) => {
				if (err) throw err;
				req.user.password = hash;
				req.user
					.save()
					.then(updatedUser => {
						const payload = {
							id: updatedUser.id,
							hashedPass: updatedUser.password
						};
						// Sign token
						jwt.sign(
							payload,
							process.env.SECRET_KEY,
							{
								expiresIn: 172800 // 1 year in seconds
							},
							(err, token) => {
								if (err) throw err;
								res.json({
									success: true,
									token: `Bearer ` + token
								});
							}
						);
					})
					.catch(err => console.log(err));
			});
		});
	} catch (err) {
		addErrorMessages(errorObject, err);
		next(errorObject);
	}
});

// @route POST api/users/register
// @desc Register user
// @access Public
router.post(`/register`, (req, res, next) => {
	let errorObject = createErrorObject();
	try {
		// Form validation
		const isValid = isRegisterInputValid(req.body, errorObject);
		// Check validation
		if (!isValid) {
			return res.status(400).json(errorObject);
		}

		// Check if email exists
		User.findOne({ email: req.body.email }, { upsert: false }).then(user => {
			if (user) {
				addErrorMessages(errorObject, `Email already exists`);
			}

			User.findOne({ username: req.body.username }, { upsert: false }).then(user => {
				if (user) {
					addErrorMessages(errorObject, `Username already exists`);
				}

				if (hasErrors(errorObject)) {
					return res.status(400).json(errorObject);
				}

				// Check is username exists
				User.findOne({ username: req.body.username }, { upsert: false }).then(user => {
					if (user) {
						addErrorMessages(errorObject, `Username already exists`);
						return res.status(400).json(errorObject);
					}

					if (hasErrors(errorObject)) {
						return res.status(400).json(errorObject);
					}

					const newUser = new User({
						email: req.body.email,
						password: req.body.password,
						username: req.body.username,
						color: req.body.color
					});
					// Hash password before saving in database
					bcrypt.genSalt(10, (err, salt) => {
						if (err) throw err;
						bcrypt.hash(newUser.password, salt, (err, hash) => {
							if (err) throw err;
							newUser.password = hash;
							newUser
								.save()
								.then(user => res.json(`Success! User created`))
								.catch(err => console.log(err));
						});
					});
				});
			});
		});
	} catch (err) {
		addErrorMessages(errorObject, err);
		next(errorObject);
	}
});

// @route POST api/users/login
// @desc Login user and return JWT token
// @access Public
router.post(`/login`, (req, res) => {
	let errorObject = createErrorObject();
	console.log(`About to validate`);
	// Form validation
	const isValid = isLoginInputValid(req.body, errorObject);
	// Check validation
	if (!isValid) {
		console.log(`Not Valid`);
		return res.status(400).json(errorObject);
	}
	const email = req.body.email;
	const password = req.body.password;
	// Find user by email
	User.findOne({ email }).then(user => {
		// Check if user exists
		if (!user) {
			addErrorMessages(errorObject, `Email not found`);
			return res.status(400).json(errorObject);
		}
		// Check password
		bcrypt.compare(password, user.password).then(isMatch => {
			if (isMatch) {
				// User matched
				// Create JWT Payload
				const payload = {
					id: user.id,
					hashedPass: user.password
				};
				// Sign token
				jwt.sign(
					payload,
					process.env.SECRET_KEY,
					{
						expiresIn: 604800 // 1 year in seconds
					},
					(err, token) => {
						if (err) throw err;
						res.json({
							success: true,
							token: `Bearer ` + token,
							user: {
								username: user.username,
								email: user.email,
								updatedAt: user.updatedAt,
								roles: user.roles,
								createdAt: user.createdAt,
								imageUrl: user.imageUrl,
								color: user.color,
								_id: user._id
							}
						});
					}
				);
			} else {
				addErrorMessages(errorObject, `Password incorrect`);
				return res.status(400).json(errorObject);
			}
		});
	});
});

// router.post(`/user/avatar`, passport.authenticate(`jwt`, ), (req, res) => {
// 	let errorObject = createErrorObject();
// 	const query = { email: req.user.email };
// 	User.findOneAndUpdate(
// 		query,
// 		{ imageUrl: req.imageUrl },
// 		{
// 			runValidators: true
// 		},

// 	);

// 	User.findOne({ email }).then(user => {
// 		if (!user) {
// 			addErrorMessages(errorObject, `User not found`);
// 			return res.status(400).json(errorObject);
// 		} else {
// 		}
// 	});
// });

module.exports = router;
